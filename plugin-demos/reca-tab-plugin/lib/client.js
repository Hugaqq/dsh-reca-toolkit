window.__ModuleLoader__.load({
  id: "dsh-reca-tab-plugin-demo",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /* This source is wrapped as a Harness lazy-CJS client bundle by scripts/build.mjs. */
    const React = require('react');
    const h = React.createElement;
    
    const RecaTraceAdapter = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      'use strict'
      
      /**
       * ReCA Gateway -> presentation snapshot adapter.
       *
       * This module is intentionally model-free. It only polls HTTP JSON endpoints,
       * parses stable fields/log markers, and projects them into one UI-facing shape.
       */
      
      const TRACE_SNAPSHOT_VERSION = 1
      const DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:8787'
      const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled', 'interrupted'])
      
      function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      }
      
      function list(value) {
        return Array.isArray(value) ? value : []
      }
      
      function number(value) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : undefined
      }
      
      function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value))
      }
      
      function cleanText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
      }
      
      function shorten(value, maximum = 180) {
        const text = cleanText(value)
        return text.length <= maximum ? text : `${text.slice(0, Math.max(1, maximum - 1))}…`
      }
      
      function humanizeId(value) {
        return cleanText(value)
          .replace(/^seg_/, '')
          .replace(/^shot\d+_/, '')
          .replace(/^a\d+_/, '')
          .replace(/_start$/, '')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Untitled'
      }
      
      function values(value) {
        if (Array.isArray(value)) return value
        if (value && typeof value === 'object') return Object.values(value)
        return []
      }
      
      function eventKey(event) {
        const row = object(event)
        return [row.seq, row.ts, row.type, row.node_id, row.text, row.detail]
          .map((item) => item == null ? '' : String(item))
          .join('|')
      }
      
      function eventTime(event, fallback = 0) {
        return number(object(event).ts) ?? number(object(event).t) ?? fallback
      }
      
      function mergeTraceEvents(previous, incoming, maximum = 4000) {
        const seen = new Set()
        const merged = []
        for (const row of [...list(previous), ...list(incoming)]) {
          if (!row || typeof row !== 'object') continue
          const key = eventKey(row)
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(row)
        }
        merged.sort((left, right) => eventTime(left) - eventTime(right))
        return merged.slice(-maximum)
      }
      
      function normalizeGatewayBaseUrl(value) {
        return cleanText(value || DEFAULT_GATEWAY_BASE_URL).replace(/\/+$/, '')
      }
      
      function gatewayUrl(baseUrl, path) {
        return `${normalizeGatewayBaseUrl(baseUrl)}/${String(path).replace(/^\/+/, '')}`
      }
      
      function encodePath(path) {
        return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/')
      }
      
      /** Rewrite internal localhost/absolute artifact paths through the selected Gateway. */
      function publicArtifactUrl(value, runId, gatewayBaseUrl = DEFAULT_GATEWAY_BASE_URL) {
        const source = cleanText(value)
        if (!source || !runId) return null
      
        let relative = ''
        try {
          if (/^https?:\/\//i.test(source)) {
            const parsed = new URL(source)
            const marker = `/v1/runs/${encodeURIComponent(runId)}/artifacts/`
            const index = parsed.pathname.indexOf(marker)
            if (index >= 0) relative = decodeURIComponent(parsed.pathname.slice(index + marker.length))
            else return source
          }
        } catch {
          return null
        }
      
        if (!relative) {
          const normalized = source.replace(/\\/g, '/')
          const runMarker = `/.dsh_runs/${runId}/`
          const runIndex = normalized.lastIndexOf(runMarker)
          if (runIndex >= 0) relative = normalized.slice(runIndex + runMarker.length)
          else if (!normalized.startsWith('/')) relative = normalized.replace(/^\.\//, '')
          else {
            const publicRunIndex = normalized.lastIndexOf('/run/')
            if (publicRunIndex >= 0) relative = normalized.slice(publicRunIndex + 1)
          }
        }
      
        if (!relative) return null
        return gatewayUrl(
          gatewayBaseUrl,
          `v1/runs/${encodeURIComponent(runId)}/artifacts/${encodePath(relative)}`,
        )
      }
      
      function extractRunId(value) {
        const seen = new WeakSet()
      
        function visit(candidate, depth) {
          if (candidate == null || depth > 7) return null
          if (typeof candidate === 'string') {
            const text = candidate.trim()
            if ((text.startsWith('{') || text.startsWith('[')) && text.length < 100000) {
              try {
                const parsed = visit(JSON.parse(text), depth + 1)
                if (parsed) return parsed
              } catch {
                // Tool output is frequently prose around JSON, so regex is the fallback.
              }
            }
            const match = text.match(/\brun[_\s-]?id\b\s*["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]{6,64})/i)
            return match ? match[1] : null
          }
          if (typeof candidate !== 'object') return null
          if (seen.has(candidate)) return null
          seen.add(candidate)
          if (!Array.isArray(candidate)) {
            for (const key of ['run_id', 'runId']) {
              const found = cleanText(candidate[key])
              if (found) return found
            }
          }
          for (const item of Array.isArray(candidate) ? candidate : Object.values(candidate)) {
            const found = visit(item, depth + 1)
            if (found) return found
          }
          return null
        }
      
        return visit(value, 0)
      }
      
      function segmentFact(map, id) {
        if (!map.has(id)) map.set(id, { id, validations: [], repairs: [] })
        return map.get(id)
      }
      
      function parseEventFacts(rawEvents) {
        const events = mergeTraceEvents([], rawEvents)
        const segments = new Map()
        const anchorsReady = new Set()
        const assetsReady = new Set()
        const stageStarts = new Map()
        const stageEnds = new Map()
        let concatStartedAt
        let finalReadyAt
      
        events.forEach((raw, index) => {
          const event = object(raw)
          const timestamp = eventTime(event, index)
          const type = cleanText(event.type)
          const nodeId = cleanText(event.node_id)
          const text = cleanText(event.text)
      
          if (type === 'reca.asset.ready' && nodeId) assetsReady.add(nodeId)
          if (type === 'reca.anchor.ready' && nodeId) anchorsReady.add(nodeId)
          if (type === 'reca.segment.start' && nodeId) {
            const fact = segmentFact(segments, nodeId)
            fact.startedAt = fact.startedAt ?? timestamp
          }
          if (type === 'reca.segment.ready' && nodeId) {
            const fact = segmentFact(segments, nodeId)
            fact.startedAt = fact.startedAt ?? timestamp
            fact.doneAt = timestamp
          }
          if ((type === 'reca.validation.pass' || type === 'reca.validation.flagged') && nodeId) {
            segmentFact(segments, nodeId).validations.push({
              timestamp,
              attempt: number(event.attempt),
              passed: type === 'reca.validation.pass',
              score: number(event.score),
              detail: cleanText(event.detail),
            })
          }
          if (type === 'reca.repair.start' && nodeId) {
            const fact = segmentFact(segments, nodeId)
            fact.repairs.push({
              timestamp,
              attempt: number(event.attempt) ?? fact.repairs.length + 1,
              strategy: cleanText(event.strategy) || 'repair',
              detail: cleanText(event.detail),
            })
          }
          if (type === 'reca.concat.start') concatStartedAt = timestamp
          if (type === 'reca.final.ready') finalReadyAt = timestamp
      
          let match = text.match(/^\[render-local\]\s+(\S+)\s+->/)
          if (match) {
            const id = match[1]
            if (/^a\d+_/i.test(id)) anchorsReady.add(id)
            else assetsReady.add(id)
          }
      
          match = text.match(/^\[segment-trace\]\s+(\S+):\s+refs=/)
          if (match) segmentFact(segments, match[1]).startedAt ??= timestamp
      
          match = text.match(/^\[segment-trace\]\s+(\S+):\s+done\s+->/)
          if (match) {
            const fact = segmentFact(segments, match[1])
            fact.startedAt ??= timestamp
            fact.doneAt = timestamp
          }
      
          match = text.match(/^\[segment-validate\]\s+(\S+)\s+attempt\s+(\d+)\/(\d+):\s+pass=(True|False)\s+overall=([0-9.]+)/i)
          if (match) {
            const separator = text.indexOf('|')
            segmentFact(segments, match[1]).validations.push({
              timestamp,
              attempt: Number(match[2]),
              totalAttempts: Number(match[3]),
              passed: match[4].toLowerCase() === 'true',
              score: Number(match[5]),
              detail: separator >= 0 ? cleanText(text.slice(separator + 1)) : '',
            })
          }
      
          match = text.match(/^\[router\]\s+(\S+):\s+strategy=([^|\s]+)/)
          if (match) {
            const fact = segmentFact(segments, match[1])
            fact.repairs.push({
              timestamp,
              attempt: fact.repairs.length + 1,
              strategy: match[2],
              detail: text.includes('|') ? cleanText(text.slice(text.indexOf('|') + 1)) : '',
            })
          }
      
          match = text.match(/^\[stage\]\s+([^\s]+)\s+(START|dt=)/)
          if (match) {
            const stage = match[1].replace(/-wait$/, '')
            if (match[2] === 'START') stageStarts.set(stage, timestamp)
            else stageEnds.set(stage, timestamp)
            if (stage === 'concat' && match[2] === 'START') concatStartedAt = timestamp
            if (stage === 'concat' && match[2] === 'dt=') finalReadyAt = timestamp
          }
        })
      
        return {
          events,
          segments,
          anchorsReady,
          assetsReady,
          stageStarts,
          stageEnds,
          concatStartedAt,
          finalReadyAt,
          updatedAt: events.reduce((latest, event) => Math.max(latest, eventTime(event)), 0),
        }
      }
      
      function displayStatus(rawState) {
        const state = cleanText(rawState).toLowerCase()
        if (state === 'succeeded') return 'done'
        if (state === 'failed') return 'failed'
        if (state === 'cancelled') return 'cancelled'
        if (state === 'interrupted') return 'interrupted'
        if (state === 'queued' || state === 'pending') return 'pending'
        return 'active'
      }
      
      function storyTitle(story, runId) {
        const sentences = cleanText(story).split(/(?<=[。！？!?])\s*/).filter(Boolean)
        const chosen = sentences.find((sentence, index) => index > 0 && !/^(请|我想|制作|生成)/.test(sentence))
          || sentences[1]
          || sentences[0]
        return chosen ? shorten(chosen.replace(/[。！？!?]+$/, ''), 68) : `ReCA run ${runId}`
      }
      
      function normalizeArtifacts(manifest, runId, gatewayBaseUrl) {
        const entries = list(object(manifest).artifacts).map((raw) => {
          const item = object(raw)
          const path = cleanText(item.path)
          return {
            kind: cleanText(item.kind) || 'artifact',
            path,
            mime: cleanText(item.mime) || 'application/octet-stream',
            status: cleanText(item.status) || 'unknown',
            url: publicArtifactUrl(item.url || path, runId, gatewayBaseUrl),
          }
        })
        return {
          entries,
          byKind: Object.fromEntries(entries.map((item) => [item.kind, item])),
        }
      }
      
      function normalizeRecaTraceSnapshot(input) {
        const source = object(input)
        const status = object(source.status)
        const reca = object(status.reca_state)
        const renderPlan = object(source.renderPlan || source.render_plan)
        const audit = object(source.audit)
        const request = object(source.request)
        const runId = cleanText(source.runId || status.run_id || reca.run_id)
        if (!runId) throw new Error('normalizeRecaTraceSnapshot: run_id is required')
      
        const gatewayBaseUrl = normalizeGatewayBaseUrl(source.gatewayBaseUrl)
        const facts = parseEventFacts(source.events)
        const rawState = cleanText(reca.state || status.gateway_state || status.state || 'queued').toLowerCase()
        const rootStatus = displayStatus(rawState)
        const terminal = TERMINAL_STATES.has(rawState)
        const succeeded = rawState === 'succeeded'
        const recaStage = cleanText(reca.stage || status.reca_stage || status.stage || 'queued')
        const recaStatus = cleanText(reca.status)
      
        const shotsRaw = list(renderPlan.shots)
        const segmentsRaw = values(renderPlan.segments)
        const segmentOrder = new Map(segmentsRaw.map((segment, index) => [cleanText(object(segment).id), index]))
        const segmentsByShot = new Map()
        for (const raw of segmentsRaw) {
          const segment = object(raw)
          const shotId = cleanText(segment.shot_id)
          if (!segmentsByShot.has(shotId)) segmentsByShot.set(shotId, [])
          segmentsByShot.get(shotId).push(segment)
        }
        for (const rows of segmentsByShot.values()) {
          rows.sort((left, right) => {
            const leftIndex = number(left.segment_index_in_shot) ?? segmentOrder.get(cleanText(left.id)) ?? 0
            const rightIndex = number(right.segment_index_in_shot) ?? segmentOrder.get(cleanText(right.id)) ?? 0
            return leftIndex - rightIndex
          })
        }
      
        const planReady = shotsRaw.length > 0 || segmentsRaw.length > 0
        const assetGroups = [
          ['portrait', renderPlan.portrait_plan],
          ['location', renderPlan.location_plan],
          ['prop', renderPlan.prop_plan],
        ]
        const assetCountFromState = number(reca.asset_count) ?? 0
        const assetsPassed = succeeded
          || (assetCountFromState > 0 && (recaStage !== 'asset_generation' || recaStatus === 'done'))
          || ['validating', 'rendering', 'succeeded'].includes(recaStage)
        const assetRows = []
        for (const [fallbackKind, group] of assetGroups) {
          for (const raw of values(group)) {
            const item = object(raw)
            const imageRequest = object(item.image_request)
            const id = cleanText(item.id || imageRequest.request_id)
            if (!id) continue
            const ready = succeeded || assetsPassed || facts.assetsReady.has(id)
            assetRows.push({
              id,
              kind: cleanText(item.kind || fallbackKind),
              label: cleanText(imageRequest.name) || humanizeId(id),
              status: ready ? 'done' : (recaStage === 'asset_generation' ? 'active' : 'pending'),
              prompt: cleanText(imageRequest.prompt),
              imageUrl: ready ? publicArtifactUrl(imageRequest.output_path, runId, gatewayBaseUrl) : null,
            })
          }
        }
      
        const anchorsRaw = list(renderPlan.boundary_anchors || object(renderPlan.boundarys).boundary_anchors)
        const anySegmentStarted = [...facts.segments.values()].some((fact) => fact.startedAt != null)
        const anchorsPassed = succeeded
          || facts.stageEnds.has('anchor-validator')
          || anySegmentStarted
          || recaStage === 'rendering'
        const anchorByShot = new Map()
        anchorsRaw.forEach((raw, index) => {
          const anchor = object(raw)
          const shotId = cleanText(anchor.shot_id || object(shotsRaw[index]).id)
          if (shotId) anchorByShot.set(shotId, anchor)
        })
      
        let completedSegments = 0
        let activeSegments = 0
        const normalizedShots = shotsRaw.map((rawShot, shotIndex) => {
          const shot = object(rawShot)
          const shotId = cleanText(shot.id) || `shot-${shotIndex + 1}`
          const segmentRows = segmentsByShot.get(shotId) || []
          const normalizedSegments = segmentRows.map((rawSegment, segmentIndex) => {
            const segment = object(rawSegment)
            const segmentRequest = object(segment.segment_request)
            const id = cleanText(segment.id || segmentRequest.request_id) || `${shotId}-segment-${segmentIndex + 1}`
            const fact = facts.segments.get(id) || { validations: [], repairs: [] }
            const validations = list(fact.validations).slice().sort((left, right) => left.timestamp - right.timestamp)
            const repairs = list(fact.repairs).slice().sort((left, right) => left.timestamp - right.timestamp)
            const validation = validations.at(-1)
            let nodeStatus = 'pending'
            if (succeeded || fact.doneAt != null || (validation && validation.passed && terminal)) nodeStatus = 'done'
            else if (fact.startedAt != null || validations.length > 0 || repairs.length > 0) nodeStatus = 'active'
            if (rawState === 'failed' && nodeStatus === 'active') nodeStatus = 'failed'
            if (nodeStatus === 'done') completedSegments += 1
            if (nodeStatus === 'active') activeSegments += 1
      
            const outputPath = cleanText(segmentRequest.output_path)
            const tailPath = outputPath.endsWith('.mp4') ? outputPath.slice(0, -4) + '.tail.png' : ''
            return {
              id,
              shotId,
              index: number(segment.segment_index_in_shot) ?? segmentIndex,
              kind: 'segment',
              label: `Segment ${String(segmentIndex + 1).padStart(2, '0')}`,
              status: nodeStatus,
              durationS: number(segmentRequest.duration_s) ?? number(segment.duration_s),
              requestType: cleanText(segment.request_type || 'SegmentRequest'),
              prompt: cleanText(segmentRequest.prompt),
              endState: cleanText(segment.end_state),
              score: validation ? validation.score : undefined,
              validation: validation || null,
              validations,
              repairs,
              videoUrl: nodeStatus === 'done' ? publicArtifactUrl(outputPath, runId, gatewayBaseUrl) : null,
              posterUrl: nodeStatus === 'done' ? publicArtifactUrl(tailPath, runId, gatewayBaseUrl) : null,
            }
          })
      
          let shotStatus = 'pending'
          if (normalizedSegments.length > 0 && normalizedSegments.every((segment) => segment.status === 'done')) shotStatus = 'done'
          else if (normalizedSegments.some((segment) => ['active', 'failed'].includes(segment.status))) shotStatus = rawState === 'failed' ? 'failed' : 'active'
          else if (succeeded) shotStatus = 'done'
      
          const anchor = object(anchorByShot.get(shotId))
          const anchorRequest = object(anchor.image_request)
          const anchorId = cleanText(anchor.id || anchorRequest.request_id)
          const anchorReady = Boolean(anchorId) && (anchorsPassed || facts.anchorsReady.has(anchorId))
          return {
            id: shotId,
            index: shotIndex,
            kind: 'shot',
            label: humanizeId(shotId),
            status: shotStatus,
            durationS: number(shot.duration_s),
            storyGoal: cleanText(shot.story_goal),
            visualIntent: cleanText(shot.visual_intent),
            startState: cleanText(shot.start_state),
            endState: cleanText(shot.end_state),
            anchor: anchorId ? {
              id: anchorId,
              status: anchorReady ? 'done' : (recaStage === 'validating' ? 'active' : 'pending'),
              prompt: cleanText(anchorRequest.prompt),
              imageUrl: anchorReady ? publicArtifactUrl(anchorRequest.output_path, runId, gatewayBaseUrl) : null,
            } : null,
            segments: normalizedSegments,
          }
        })
      
        const segmentCount = segmentsRaw.length || number(reca.segment_count) || 0
        const shotCount = shotsRaw.length || number(reca.shot_count) || 0
        const repairCountFromEvents = normalizedShots.reduce(
          (sum, shot) => sum + shot.segments.reduce((inner, segment) => inner + segment.repairs.length, 0),
          0,
        )
        const repairCount = Math.max(repairCountFromEvents, number(object(reca.audit_meta).repairs) || 0)
        const imageAssetCount = Math.max(assetRows.length + anchorsRaw.length, assetCountFromState)
        const allSegmentsDone = segmentCount > 0 && completedSegments >= segmentCount
        const artifacts = normalizeArtifacts(source.artifacts || status.artifact_manifest, runId, gatewayBaseUrl)
        const finalArtifact = artifacts.byKind.final_video
        const contactArtifact = artifacts.byKind.contact_sheet
        const finalReady = succeeded
          || facts.finalReadyAt != null
          || (finalArtifact && finalArtifact.status === 'ready')
        const concatActive = !finalReady && facts.concatStartedAt != null
      
        const planStageStatus = planReady ? 'done' : (terminal ? rootStatus : 'active')
        const assetsStageStatus = assetsPassed ? 'done' : (planReady ? 'active' : 'pending')
        const renderStageStatus = (succeeded || allSegmentsDone) ? 'done' : (activeSegments > 0 || recaStage === 'rendering' ? 'active' : 'pending')
        const hasValidation = [...facts.segments.values()].some((fact) => fact.validations.length > 0)
        const auditState = cleanText(reca.audit_state || status.audit_state || audit.state || 'audit_pending')
        const auditFinished = ['audited', 'audit_repaired', 'audit_failed', 'audit_skipped'].includes(auditState)
        const validationStageStatus = succeeded || (allSegmentsDone && auditFinished)
          ? 'done'
          : (hasValidation || recaStage === 'validating' ? 'active' : 'pending')
        const concatStageStatus = finalReady ? 'done' : (concatActive ? 'active' : 'pending')
        const stages = [
          { id: 'plan', label: 'Plan', status: planStageStatus },
          { id: 'assets', label: 'Assets', status: assetsStageStatus },
          { id: 'render', label: 'Render', status: renderStageStatus },
          { id: 'validate', label: 'Validate', status: validationStageStatus },
          { id: 'concat', label: 'Concat', status: concatStageStatus },
        ]
      
        let progress = rootStatus === 'pending' ? 0 : 3
        if (planReady) progress = Math.max(progress, 15)
        if (assetsPassed) progress = Math.max(progress, 30)
        if (segmentCount > 0) progress = Math.max(progress, 30 + Math.round(55 * completedSegments / segmentCount))
        if (activeSegments > 0) progress = Math.max(progress, 35)
        if (allSegmentsDone) progress = Math.max(progress, 88)
        if (concatActive) progress = Math.max(progress, 95)
        if (finalReady) progress = 100
        for (const candidate of [number(status.progress), number(status.reca_progress), number(reca.progress)]) {
          if (candidate != null) progress = Math.max(progress, Math.round(clamp(candidate, 0, 1) * 100))
        }
        if (!succeeded && progress >= 100) progress = 99
      
        const nodes = [{
          id: 'root', parentId: null, depth: 0, kind: 'root',
          label: storyTitle(request.story, runId), status: rootStatus,
          meta: `${shotCount} shots · ${segmentCount} segments`,
          detail: shorten(request.story || status.error || `ReCA run ${runId}`, 320),
        }, {
          id: 'plan', parentId: 'root', depth: 1, kind: 'phase',
          label: 'Narrative & render plan', status: planStageStatus,
          meta: planReady ? `${shotCount} shots` : recaStage,
          detail: planReady ? 'Render plan loaded from the real run artifact.' : 'Waiting for render_plan.json.',
        }, {
          id: 'assets', parentId: 'root', depth: 1, kind: 'phase',
          label: 'Shared visual state', status: assetsStageStatus,
          meta: `${imageAssetCount} assets`,
          detail: 'Portrait, location, prop, and anchor images shared across shots.',
        }]
      
        for (const asset of assetRows) {
          nodes.push({
            id: `asset:${asset.id}`, parentId: 'assets', depth: 2, kind: 'asset',
            label: asset.label, status: asset.status, meta: asset.kind,
            detail: shorten(asset.prompt, 280), imageUrl: asset.imageUrl,
          })
        }
      
        for (const shot of normalizedShots) {
          nodes.push({
            id: shot.id, parentId: 'root', depth: 1, kind: 'shot', label: shot.label,
            status: shot.status, meta: `${shot.segments.length} segments`,
            detail: shorten(shot.storyGoal || shot.visualIntent, 320),
            durationS: shot.durationS,
          })
          if (shot.anchor) {
            nodes.push({
              id: `anchor:${shot.anchor.id}`, parentId: shot.id, depth: 2, kind: 'anchor',
              label: 'Start anchor', status: shot.anchor.status, meta: shot.anchor.id,
              detail: shorten(shot.anchor.prompt, 280), imageUrl: shot.anchor.imageUrl,
            })
          }
          for (const segment of shot.segments) {
            nodes.push({
              id: segment.id, parentId: shot.id, depth: 2, kind: 'segment',
              label: segment.label, status: segment.status,
              meta: segment.durationS != null ? `${segment.durationS}s` : segment.requestType,
              detail: shorten(segment.prompt || segment.endState, 360),
              durationS: segment.durationS, score: segment.score,
              videoUrl: segment.videoUrl, posterUrl: segment.posterUrl,
            })
            segment.repairs.forEach((repair, repairIndex) => {
              const laterValidation = segment.validations.some((validation) => validation.timestamp > repair.timestamp)
              nodes.push({
                id: `repair:${segment.id}:${repair.attempt || repairIndex + 1}`,
                parentId: segment.id,
                depth: 3,
                kind: 'repair',
                label: humanizeId(repair.strategy),
                status: laterValidation || segment.status === 'done' ? 'done' : (segment.status === 'failed' ? 'failed' : 'active'),
                meta: `attempt ${repair.attempt || repairIndex + 1}`,
                detail: shorten(repair.detail, 360),
              })
            })
          }
        }
      
        nodes.push({
          id: 'concat', parentId: 'root', depth: 1, kind: 'artifact',
          label: 'Final concat', status: concatStageStatus,
          meta: finalReady ? 'final.mp4 ready' : 'waiting',
          detail: finalReady ? 'The final video artifact is available from the Gateway.' : 'Unlocks after render and validation complete.',
          videoUrl: finalReady ? publicArtifactUrl(
            (finalArtifact && (finalArtifact.url || finalArtifact.path)) || status.final_video || 'run/final.mp4',
            runId,
            gatewayBaseUrl,
          ) : null,
        })
      
        const updatedAt = Math.max(
          number(reca.updated_at) || 0,
          facts.updatedAt,
          number(status.ended_at) || 0,
          number(status.started_at) || 0,
          number(status.created_at) || 0,
        )
        const story = cleanText(request.story || request.narrative)
      
        return {
          version: TRACE_SNAPSHOT_VERSION,
          runId,
          title: storyTitle(story, runId),
          story,
          state: rawState,
          status: rootStatus,
          terminal,
          phase: recaStage,
          progress: clamp(Math.round(progress), 0, 100),
          updatedAt: updatedAt || null,
          error: cleanText(status.error || reca.error) || null,
          auditState,
          videoState: cleanText(reca.video_state || status.video_state || 'pending'),
          stages,
          counts: {
            shots: shotCount,
            segments: segmentCount,
            completedSegments,
            assets: imageAssetCount,
            repairs: repairCount,
          },
          assets: assetRows,
          shots: normalizedShots,
          nodes,
          artifacts: artifacts.entries,
          film: {
            src: finalReady ? publicArtifactUrl(
              (finalArtifact && (finalArtifact.url || finalArtifact.path)) || status.final_video || 'run/final.mp4',
              runId,
              gatewayBaseUrl,
            ) : null,
            poster: contactArtifact && contactArtifact.status === 'ready'
              ? publicArtifactUrl(contactArtifact.url || contactArtifact.path, runId, gatewayBaseUrl)
              : null,
          },
          recentEvents: facts.events.slice(-24).map((event) => ({
            ts: eventTime(event) || null,
            type: cleanText(event.type) || 'log',
            text: shorten(event.text || event.detail || event.label, 320),
          })),
        }
      }
      
      async function fetchJson(fetchImpl, url, signal, optional = false) {
        let response
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal,
          })
        } catch (error) {
          if (optional) return undefined
          throw error
        }
        if (!response.ok) {
          if (optional && response.status === 404) return undefined
          throw new Error(`ReCA Gateway ${response.status} for ${url}`)
        }
        try {
          return await response.json()
        } catch (error) {
          if (optional) return undefined
          throw error
        }
      }
      
      /** Fetch one real Gateway sample. status is required; all other inputs degrade independently. */
      async function fetchRecaTraceInputs(options) {
        const settings = object(options)
        const runId = cleanText(settings.runId)
        if (!runId) throw new Error('fetchRecaTraceInputs: runId is required')
        const baseUrl = normalizeGatewayBaseUrl(settings.gatewayBaseUrl)
        const fetchImpl = settings.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null)
        if (!fetchImpl) throw new Error('fetchRecaTraceInputs: fetch implementation is required')
        const signal = settings.signal
        const cache = object(settings.cache)
        const prefix = gatewayUrl(baseUrl, `v1/runs/${encodeURIComponent(runId)}`)
      
        const [status, eventsPayload, artifacts, renderPlan, audit, request, runReport] = await Promise.all([
          fetchJson(fetchImpl, prefix, signal, false),
          fetchJson(fetchImpl, `${prefix}/events`, signal, true),
          fetchJson(fetchImpl, `${prefix}/artifacts`, signal, true),
          // The manifest is intentionally not authoritative during an active run:
          // it is written at start and terminal state, while render_plan appears in between.
          fetchJson(fetchImpl, `${prefix}/artifacts/render_plan.json`, signal, true),
          fetchJson(fetchImpl, `${prefix}/artifacts/run/audit.json`, signal, true),
          cache.request || fetchJson(fetchImpl, `${prefix}/artifacts/request.json`, signal, true),
          fetchJson(fetchImpl, `${prefix}/artifacts/run/run_report.json`, signal, true),
        ])
      
        return {
          runId,
          gatewayBaseUrl: baseUrl,
          status,
          events: list(object(eventsPayload).events),
          artifacts: artifacts || cache.artifacts || object(status).artifact_manifest || {},
          renderPlan: renderPlan || cache.renderPlan || {},
          audit: audit || cache.audit || {},
          request: request || cache.request || {},
          runReport: runReport || cache.runReport || {},
          cache: {
            artifacts: artifacts || cache.artifacts,
            renderPlan: renderPlan || cache.renderPlan,
            audit: audit || cache.audit,
            request: request || cache.request,
            runReport: runReport || cache.runReport,
          },
        }
      }
      
      /**
       * Stateful non-overlapping poller. It accumulates the Gateway's rolling 200-log
       * window so completed segment/repair nodes do not disappear from the UI.
       */
      function createRecaTracePoller(options = {}) {
        const settings = object(options)
        let activeRunId = cleanText(typeof settings.runId === 'function' ? '' : settings.runId)
        let running = false
        let timer = null
        let inFlight = null
        let controller = null
        let cachedInputs = {}
        let accumulatedEvents = []
        let lastSnapshot = null
        const intervalMs = Math.max(250, number(settings.intervalMs) || 1800)
        const stopOnTerminal = settings.stopOnTerminal !== false
      
        function currentRunId() {
          return cleanText(typeof settings.runId === 'function' ? settings.runId() : activeRunId)
        }
      
        async function performRefresh() {
          if (inFlight) return inFlight
          const runId = currentRunId()
          if (!runId) throw new Error('ReCA trace poller is waiting for run_id')
          controller = new AbortController()
          inFlight = (async () => {
            try {
              const inputs = await fetchRecaTraceInputs({
                runId,
                gatewayBaseUrl: settings.gatewayBaseUrl,
                fetch: settings.fetch,
                signal: controller.signal,
                cache: cachedInputs,
              })
              cachedInputs = inputs.cache
              accumulatedEvents = mergeTraceEvents(accumulatedEvents, inputs.events, settings.maxEvents || 4000)
              lastSnapshot = normalizeRecaTraceSnapshot({ ...inputs, events: accumulatedEvents })
              if (typeof settings.onSnapshot === 'function') settings.onSnapshot(lastSnapshot)
              return lastSnapshot
            } catch (error) {
              if (error && error.name === 'AbortError') return lastSnapshot
              if (typeof settings.onError === 'function') settings.onError(error, lastSnapshot)
              throw error
            } finally {
              controller = null
              inFlight = null
            }
          })()
          return inFlight
        }
      
        async function loop() {
          try {
            const snapshot = await performRefresh()
            if (snapshot && snapshot.terminal && stopOnTerminal) running = false
          } catch {
            // onError already received the failure. Keep the last useful snapshot.
          }
          if (running) timer = setTimeout(loop, intervalMs)
        }
      
        return {
          start() {
            if (running) return
            running = true
            void loop()
          },
          stop() {
            running = false
            if (timer) clearTimeout(timer)
            timer = null
            if (controller) controller.abort()
          },
          refresh: performRefresh,
          setRunId(runId) {
            const next = cleanText(runId)
            if (next === activeRunId) return
            activeRunId = next
            cachedInputs = {}
            accumulatedEvents = []
            lastSnapshot = null
          },
          getSnapshot() {
            return lastSnapshot
          },
          isRunning() {
            return running
          },
        }
      }
      
      module.exports = {
        TRACE_SNAPSHOT_VERSION,
        DEFAULT_GATEWAY_BASE_URL,
        createRecaTracePoller,
        extractRunId,
        fetchRecaTraceInputs,
        mergeTraceEvents,
        normalizeRecaTraceSnapshot,
        publicArtifactUrl,
      }
      
      return module.exports;
    })();
    const RecaTrace = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      'use strict'
      
      const TRACE_RPC_CHANNEL = '/reca-trace'
      const RUN_CACHE_PREFIX = 'reca-trace:session:'
      const EMPTY_SNAPSHOT = null
      
      function latestRunIdFromConversation(snapshot) {
        let latestSeq = -1
        let latestRunId = null
        for (const node of Array.isArray(snapshot?.nodes) ? snapshot.nodes : []) {
          if (node?.kind !== 'tool-result' || node.isError) continue
          if (!['reca_create_video', 'reca_start'].includes(node.call?.name)) continue
          const runId = RecaTraceAdapter.extractRunId(node.content)
          const seq = Number(node.seq)
          if (runId && Number.isFinite(seq) && seq >= latestSeq) {
            latestSeq = seq
            latestRunId = runId
          }
        }
        return latestRunId
      }
      
      function cachedRunId(sessionId) {
        if (!sessionId || typeof sessionStorage === 'undefined') return null
        try { return sessionStorage.getItem(`${RUN_CACHE_PREFIX}${sessionId}`) } catch { return null }
      }
      
      function rememberRunId(sessionId, runId) {
        if (!sessionId || !runId || typeof sessionStorage === 'undefined') return
        try { sessionStorage.setItem(`${RUN_CACHE_PREFIX}${sessionId}`, runId) } catch { /* optional cache */ }
      }
      
      function explicitRunId() {
        if (typeof window === 'undefined') return null
        const direct = typeof window.__RECA_RUN_ID__ === 'string' ? window.__RECA_RUN_ID__.trim() : ''
        const configured = /^[A-Za-z0-9_-]{6,128}$/.test(direct)
          ? direct
          : RecaTraceAdapter.extractRunId(window.__RECA_RUN_ID__)
        if (configured) return configured
        try {
          const query = new URLSearchParams(window.location.search).get('reca_run_id') || ''
          return /^[A-Za-z0-9_-]{6,128}$/.test(query) ? query : RecaTraceAdapter.extractRunId(query)
        } catch { return null }
      }
      
      function useSessionRunId(useSession, sessionId) {
        const detected = useSession(latestRunIdFromConversation)
        const runId = explicitRunId() || detected || cachedRunId(sessionId)
        React.useEffect(() => { rememberRunId(sessionId, detected) }, [sessionId, detected])
        return runId
      }
      
      function useOverlayRunId(useSessions, resolveSession) {
        const sessionId = useSessions((state) => state.current)
        const face = React.useMemo(
          () => sessionId ? resolveSession(sessionId) : undefined,
          [resolveSession, sessionId],
        )
        const subscribe = React.useCallback(
          (listener) => face ? face.subscribe(listener) : () => {},
          [face],
        )
        const getSnapshot = React.useCallback(
          () => face ? face.getSnapshot() : EMPTY_SNAPSHOT,
          [face],
        )
        const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT)
        const detected = latestRunIdFromConversation(snapshot)
        const runId = explicitRunId() || detected || cachedRunId(sessionId)
        React.useEffect(() => { rememberRunId(sessionId, detected) }, [sessionId, detected])
        return { runId, sessionId }
      }
      
      function keepInput(previous, incoming, key) {
        return incoming?.[key] && Object.keys(incoming[key]).length > 0
          ? incoming[key]
          : previous?.[key] || {}
      }
      
      function traceStores() {
        if (typeof window === 'undefined') return new Map()
        if (!window.__RECA_TRACE_POLL_STORES__) window.__RECA_TRACE_POLL_STORES__ = new Map()
        return window.__RECA_TRACE_POLL_STORES__
      }
      
      function createTraceStore(connection, runId, intervalMs) {
        let view = { snapshot: null, mode: 'connecting', error: null, fetchedAt: null }
        let cached = {}
        let events = []
        let timer = null
        let controller = null
        let running = false
        const listeners = new Set()
      
        const publish = (next) => {
          view = next
          for (const listener of [...listeners]) listener()
        }
        const schedule = () => {
          if (running) timer = window.setTimeout(refresh, intervalMs)
        }
        const refresh = async () => {
          if (!running || controller) return
          controller = new AbortController()
          try {
            const result = await connection.rpc.call(
              TRACE_RPC_CHANNEL,
              'snapshot',
              { runId },
              controller.signal,
            )
            if (!result.ok) throw new Error(result.error?.message || 'ReCA trace RPC failed')
            const incoming = result.value || {}
            events = RecaTraceAdapter.mergeTraceEvents(events, incoming.events)
            const inputs = {
              ...incoming,
              runId,
              events,
              artifacts: keepInput(cached, incoming, 'artifacts'),
              renderPlan: keepInput(cached, incoming, 'renderPlan'),
              audit: keepInput(cached, incoming, 'audit'),
              request: keepInput(cached, incoming, 'request'),
              runReport: keepInput(cached, incoming, 'runReport'),
            }
            cached = inputs
            const snapshot = RecaTraceAdapter.normalizeRecaTraceSnapshot(inputs)
            publish({ snapshot, mode: 'live', error: null, fetchedAt: incoming.fetchedAt || Date.now() })
            if (snapshot.terminal) running = false
          } catch (error) {
            if (running && error?.name !== 'AbortError') {
              publish({
                ...view,
                mode: view.snapshot ? 'stale' : 'error',
                error: error instanceof Error ? error.message : String(error),
              })
            }
          } finally {
            controller = null
            schedule()
          }
        }
      
        return {
          getSnapshot: () => view,
          subscribe(listener) {
            listeners.add(listener)
            if (!running && !view.snapshot?.terminal) {
              running = true
              void refresh()
            }
            return () => {
              listeners.delete(listener)
              if (listeners.size === 0) {
                running = false
                if (timer) window.clearTimeout(timer)
                timer = null
                if (controller) controller.abort()
                traceStores().delete(runId)
              }
            }
          },
        }
      }
      
      function resolveTraceStore(connection, runId, intervalMs) {
        if (!runId || !connection?.rpc) return null
        const stores = traceStores()
        if (!stores.has(runId)) stores.set(runId, createTraceStore(connection, runId, intervalMs))
        return stores.get(runId)
      }
      
      function useTraceSnapshot({ connection, runId, fallback, intervalMs = 1600 }) {
        const store = React.useMemo(
          () => resolveTraceStore(connection, runId, intervalMs),
          [connection, runId, intervalMs],
        )
        const subscribe = React.useCallback(
          (listener) => store ? store.subscribe(listener) : () => {},
          [store],
        )
        const getSnapshot = React.useCallback(
          () => store ? store.getSnapshot() : null,
          [store],
        )
        const view = React.useSyncExternalStore(subscribe, getSnapshot, () => null)
        if (!store || !view) {
          return { snapshot: fallback, mode: runId ? 'error' : 'demo', error: null, fetchedAt: null, runId }
        }
        return { ...view, snapshot: view.snapshot || fallback, runId }
      }
      
      module.exports = {
        latestRunIdFromConversation,
        useOverlayRunId,
        useSessionRunId,
        useTraceSnapshot,
      }
      
      return module.exports;
    })();
    
    const RECA_CSS = ".reca-tab-demo {\n  --reca-bg: #0a0d0b;\n  --reca-panel: #0f1411;\n  --reca-panel-2: #131a15;\n  --reca-line: rgba(206, 238, 195, 0.12);\n  --reca-line-strong: rgba(206, 238, 195, 0.24);\n  --reca-text: #e7eee8;\n  --reca-muted: #7f8d83;\n  --reca-lime: #b9ff66;\n  --reca-green: #62db91;\n  --reca-cyan: #73d9e7;\n  --reca-amber: #ffb45f;\n  --reca-violet: #aa91ff;\n  --reca-rose: #ff6f7f;\n  position: relative;\n  min-width: 0;\n  min-height: 100%;\n  overflow: auto;\n  color: var(--reca-text);\n  background:\n    radial-gradient(circle at 64% -10%, rgba(185, 255, 102, 0.09), transparent 34rem),\n    radial-gradient(circle at 8% 24%, rgba(115, 217, 231, 0.05), transparent 24rem),\n    var(--reca-bg);\n  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\n.reca-tab-demo * { box-sizing: border-box; }\n.reca-tab-demo button { font: inherit; }\n\n.reca-tab-demo .reca-topline {\n  position: sticky;\n  z-index: 10;\n  top: 0;\n  display: grid;\n  grid-template-columns: minmax(220px, 1fr) auto;\n  gap: 18px;\n  align-items: center;\n  min-height: 70px;\n  padding: 12px 22px;\n  border-bottom: 1px solid var(--reca-line);\n  background: rgba(10, 13, 11, 0.91);\n  backdrop-filter: blur(18px);\n}\n\n.reca-tab-demo .reca-eyebrow {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 4px;\n  color: var(--reca-lime);\n  font: 700 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace;\n  letter-spacing: .16em;\n  text-transform: uppercase;\n}\n\n.reca-tab-demo .reca-live-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--reca-green);\n  box-shadow: 0 0 0 4px rgba(98, 219, 145, .11), 0 0 18px rgba(98, 219, 145, .7);\n}\n.reca-tab-demo .reca-mode-demo { color: var(--reca-amber); }\n.reca-tab-demo .reca-mode-demo .reca-live-dot,\n.reca-tab-demo .reca-mode-error .reca-live-dot,\n.reca-tab-demo .reca-mode-stale .reca-live-dot {\n  background: currentColor;\n  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);\n}\n.reca-tab-demo .reca-mode-error { color: var(--reca-rose); }\n.reca-tab-demo .reca-mode-stale,\n.reca-tab-demo .reca-mode-connecting { color: var(--reca-amber); }\n\n.reca-tab-demo .reca-title-row {\n  display: flex;\n  min-width: 0;\n  align-items: baseline;\n  gap: 10px;\n}\n\n.reca-tab-demo .reca-title-row strong {\n  overflow: hidden;\n  color: var(--reca-text);\n  font-size: 14px;\n  font-weight: 620;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.reca-tab-demo .reca-title-row span {\n  color: var(--reca-muted);\n  font: 9px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.reca-tab-demo .reca-controls { display: flex; align-items: center; gap: 8px; }\n.reca-tab-demo .reca-connection-pill {\n  padding: 6px 9px;\n  border: 1px solid rgba(98, 219, 145, .28);\n  border-radius: 999px;\n  color: var(--reca-green);\n  background: rgba(98, 219, 145, .06);\n  font: 700 8px ui-monospace, SFMono-Regular, Menlo, monospace;\n  letter-spacing: .1em;\n}\n.reca-tab-demo .reca-connection-pill.is-demo,\n.reca-tab-demo .reca-connection-pill.is-connecting,\n.reca-tab-demo .reca-connection-pill.is-stale { border-color: rgba(255,180,95,.32); color: var(--reca-amber); background: rgba(255,180,95,.06); }\n.reca-tab-demo .reca-connection-pill.is-error { border-color: rgba(255,111,127,.34); color: var(--reca-rose); background: rgba(255,111,127,.06); }\n.reca-tab-demo .reca-poll-note { color: #657169; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-poll-error { padding: 8px 22px; border-bottom: 1px solid rgba(255,111,127,.22); color: #d98994; background: rgba(255,111,127,.05); font: 8px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-control {\n  min-height: 34px;\n  padding: 0 12px;\n  border: 1px solid var(--reca-line);\n  border-radius: 9px;\n  color: #b8c2ba;\n  background: rgba(255, 255, 255, .025);\n  cursor: pointer;\n  font-size: 10px;\n}\n.reca-tab-demo .reca-control:hover { border-color: var(--reca-line-strong); color: white; }\n.reca-tab-demo .reca-control.primary {\n  border-color: rgba(185, 255, 102, .3);\n  color: #d7ffb1;\n  background: rgba(185, 255, 102, .08);\n}\n\n.reca-tab-demo .reca-stagebar {\n  display: grid;\n  grid-template-columns: repeat(5, minmax(76px, 1fr));\n  gap: 8px;\n  padding: 13px 22px;\n  border-bottom: 1px solid var(--reca-line);\n}\n\n.reca-tab-demo .reca-stage {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 30px;\n  gap: 7px;\n  border: 1px solid var(--reca-line);\n  border-radius: 999px;\n  color: #657168;\n  background: rgba(255, 255, 255, .012);\n  font-size: 9px;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  transition: .25s ease;\n}\n\n.reca-tab-demo .reca-stage::before {\n  content: \"\";\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  background: currentColor;\n}\n.reca-tab-demo .reca-stage.active {\n  border-color: rgba(255, 180, 95, .42);\n  color: var(--reca-amber);\n  background: rgba(255, 180, 95, .06);\n  box-shadow: inset 0 0 18px rgba(255, 180, 95, .04);\n}\n.reca-tab-demo .reca-stage.done { border-color: rgba(98, 219, 145, .24); color: var(--reca-green); }\n.reca-tab-demo .reca-stage.failed { border-color: rgba(255, 111, 127, .36); color: var(--reca-rose); }\n\n.reca-tab-demo .reca-meta {\n  display: grid;\n  grid-template-columns: 1.2fr repeat(4, 1fr);\n  border-bottom: 1px solid var(--reca-line);\n  background: rgba(255, 255, 255, .01);\n}\n.reca-tab-demo .reca-meta > div { min-width: 0; padding: 13px 18px; border-right: 1px solid var(--reca-line); }\n.reca-tab-demo .reca-meta > div:last-child { border-right: 0; }\n.reca-tab-demo .reca-meta small {\n  display: block;\n  margin-bottom: 5px;\n  color: #5e6a61;\n  font: 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;\n  letter-spacing: .12em;\n  text-transform: uppercase;\n}\n.reca-tab-demo .reca-meta strong {\n  display: block;\n  overflow: hidden;\n  color: #cbd5cd;\n  font-size: 10px;\n  font-weight: 530;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.reca-tab-demo .reca-assets { padding: 17px 22px 19px; border-bottom: 1px solid var(--reca-line); }\n.reca-tab-demo .reca-section-label {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  margin-bottom: 11px;\n  color: #68756c;\n  font: 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;\n  letter-spacing: .14em;\n  text-transform: uppercase;\n}\n.reca-tab-demo .reca-section-label em { color: #4d5850; font-style: normal; letter-spacing: 0; text-transform: none; }\n.reca-tab-demo .reca-asset-grid { display: grid; grid-template-columns: repeat(4, minmax(112px, 1fr)); gap: 8px; }\n.reca-tab-demo .reca-asset {\n  position: relative;\n  min-height: 58px;\n  overflow: hidden;\n  padding: 10px 10px 9px 47px;\n  border: 1px solid var(--reca-line);\n  border-radius: 10px;\n  color: #aeb9b0;\n  background: #0d120e;\n  opacity: .45;\n  transition: .3s ease;\n}\n.reca-tab-demo .reca-asset::before {\n  content: \"\";\n  position: absolute;\n  left: 8px;\n  top: 8px;\n  width: 32px;\n  height: 40px;\n  border-radius: 7px;\n  background:\n    var(--asset-image, linear-gradient(transparent, transparent)) center / cover,\n    linear-gradient(145deg, rgba(255,255,255,.15), transparent 50%),\n    radial-gradient(circle at 35% 30%, var(--asset-color, #73d9e7), #121813 68%);\n  filter: saturate(.65);\n}\n.reca-tab-demo .reca-asset.done { border-color: color-mix(in srgb, var(--asset-color, #73d9e7) 42%, transparent); opacity: 1; }\n.reca-tab-demo .reca-asset.active { border-color: rgba(170,145,255,.48); opacity: .86; }\n.reca-tab-demo .reca-asset strong { display: block; overflow: hidden; font-size: 9px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }\n.reca-tab-demo .reca-asset small { color: #667269; font: 7px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }\n\n.reca-tab-demo .reca-workspace {\n  display: grid;\n  grid-template-columns: minmax(620px, 1.65fr) minmax(260px, .65fr);\n  min-height: 560px;\n}\n.reca-tab-demo .reca-graph-wrap { min-width: 0; overflow: auto; border-right: 1px solid var(--reca-line); }\n.reca-tab-demo .reca-graph { position: relative; min-width: 780px; padding: 27px 22px 48px; }\n\n.reca-tab-demo .reca-root {\n  position: relative;\n  z-index: 2;\n  width: min(350px, 70%);\n  min-height: 70px;\n  margin: 0 auto 39px;\n  padding: 13px 16px;\n  border: 1px solid rgba(170, 145, 255, .38);\n  border-radius: 13px;\n  background: linear-gradient(150deg, rgba(170, 145, 255, .08), rgba(16, 22, 18, .96));\n  box-shadow: 0 0 30px rgba(170, 145, 255, .08);\n  text-align: center;\n}\n.reca-tab-demo .reca-root::after { content: \"\"; position: absolute; left: 50%; bottom: -40px; width: 1px; height: 39px; background: rgba(185, 255, 102, .4); }\n.reca-tab-demo .reca-root.done { border-color: rgba(185, 255, 102, .5); box-shadow: 0 0 35px rgba(185, 255, 102, .1); }\n.reca-tab-demo .reca-root .orbit { position: absolute; inset: -5px; border: 1px solid rgba(170,145,255,.2); border-radius: 17px; animation: reca-pulse 1.8s ease infinite; pointer-events: none; }\n.reca-tab-demo .reca-root.done .orbit { animation: none; border-color: rgba(185,255,102,.16); }\n.reca-tab-demo .reca-root small { display: block; color: var(--reca-violet); font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .13em; }\n.reca-tab-demo .reca-root strong { display: block; margin: 7px 0 4px; font-size: 13px; }\n.reca-tab-demo .reca-root span { color: #748178; font-size: 9px; }\n.reca-tab-demo .reca-trunk { position: absolute; top: 136px; left: 12.5%; right: 12.5%; height: 1px; background: rgba(185, 255, 102, .42); }\n\n.reca-tab-demo .reca-shot-grid {\n  display: grid;\n  grid-template-columns: repeat(var(--shot-count, 4), minmax(170px, 1fr));\n  gap: 12px;\n}\n.reca-tab-demo .reca-shot { position: relative; padding-top: 17px; }\n.reca-tab-demo .reca-shot::before { content: \"\"; position: absolute; top: 0; left: 50%; width: 1px; height: 17px; background: rgba(185, 255, 102, .42); }\n.reca-tab-demo .reca-shot-head {\n  min-height: 64px;\n  padding: 9px 10px;\n  border: 1px solid rgba(98, 219, 145, .24);\n  border-radius: 10px;\n  background: #0e1410;\n}\n.reca-tab-demo .reca-shot-head small { color: #587061; font: 7px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }\n.reca-tab-demo .reca-shot-head strong { display: block; margin: 5px 0 3px; overflow: hidden; font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }\n.reca-tab-demo .reca-shot-head span { color: #6c796f; font-size: 8px; }\n.reca-tab-demo .reca-shot-head.is-active { border-color: rgba(170,145,255,.42); }\n.reca-tab-demo .reca-shot-head.is-pending { opacity: .52; }\n.reca-tab-demo .reca-shot-head.is-failed { border-color: rgba(255,111,127,.42); }\n.reca-tab-demo .reca-chain { position: relative; display: grid; gap: 10px; margin-top: 15px; }\n.reca-tab-demo .reca-chain::before { content: \"\"; position: absolute; z-index: 0; top: -15px; bottom: 22px; left: 50%; width: 1px; background: rgba(255, 180, 95, .46); }\n\n.reca-tab-demo .reca-leaf {\n  position: relative;\n  z-index: 1;\n  display: grid;\n  grid-template-columns: 25px minmax(0, 1fr) auto;\n  gap: 7px;\n  align-items: center;\n  min-height: 51px;\n  padding: 8px;\n  border: 1px solid var(--reca-line);\n  border-radius: 9px;\n  color: #b9c3bb;\n  background: #101511;\n  cursor: pointer;\n  transition: transform .22s ease, border-color .22s ease, background .22s ease, opacity .22s ease;\n}\n.reca-tab-demo .reca-leaf:hover,\n.reca-tab-demo .reca-leaf.selected { border-color: rgba(115, 217, 231, .48); transform: translateY(-1px); }\n.reca-tab-demo .reca-leaf.pending { opacity: .42; }\n.reca-tab-demo .reca-leaf.running { border-color: var(--reca-violet); background: rgba(170, 145, 255, .06); box-shadow: 0 0 22px rgba(170,145,255,.12); }\n.reca-tab-demo .reca-leaf.flagged { border-color: var(--reca-rose); background: rgba(255, 111, 127, .045); }\n.reca-tab-demo .reca-leaf.done { border-color: rgba(115, 217, 231, .36); background: rgba(115, 217, 231, .035); }\n.reca-tab-demo .reca-leaf.repaired { border-color: rgba(255, 180, 95, .52); background: rgba(255, 180, 95, .045); }\n.reca-tab-demo .reca-leaf.repaired::after {\n  content: \"REPAIRED\";\n  position: absolute;\n  right: 6px;\n  top: -6px;\n  padding: 2px 5px;\n  border-radius: 4px;\n  color: #201206;\n  background: var(--reca-amber);\n  font: 800 6px ui-monospace, SFMono-Regular, Menlo, monospace;\n  letter-spacing: .08em;\n}\n.reca-tab-demo .reca-leaf-index { display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid var(--reca-line); border-radius: 6px; color: #69756c; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-leaf-copy { min-width: 0; text-align: left; }\n.reca-tab-demo .reca-leaf-copy strong { display: block; overflow: hidden; font-size: 8.5px; font-weight: 570; text-overflow: ellipsis; white-space: nowrap; }\n.reca-tab-demo .reca-leaf-copy small { color: #657169; font: 7px ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-node-state { color: #657169; font: 7px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }\n.reca-tab-demo .reca-leaf.running .reca-node-state { color: var(--reca-violet); }\n.reca-tab-demo .reca-leaf.done .reca-node-state { color: var(--reca-cyan); }\n.reca-tab-demo .reca-leaf.flagged .reca-node-state { color: var(--reca-rose); }\n.reca-tab-demo .reca-leaf.repaired .reca-node-state { color: var(--reca-amber); }\n\n.reca-tab-demo .reca-inspector { min-width: 0; display: flex; flex-direction: column; background: rgba(7, 10, 8, .65); }\n.reca-tab-demo .reca-inspector-head { padding: 20px 20px 15px; border-bottom: 1px solid var(--reca-line); }\n.reca-tab-demo .reca-inspector-kicker { color: var(--reca-cyan); font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; }\n.reca-tab-demo .reca-inspector h2 { margin: 8px 0 5px; font-size: 16px; letter-spacing: -.02em; }\n.reca-tab-demo .reca-inspector-id { overflow-wrap: anywhere; color: #606d63; font: 8px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-inspector-body { flex: 1; padding: 17px 20px; }\n.reca-tab-demo .reca-inspector-body p { margin: 0; color: #929e95; font-size: 10px; line-height: 1.7; }\n.reca-tab-demo .reca-facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 15px 0 19px; }\n.reca-tab-demo .reca-facts span { padding: 5px 7px; border: 1px solid var(--reca-line); border-radius: 6px; color: #a6b1a8; font: 7px ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-preview {\n  position: relative;\n  min-height: 160px;\n  overflow: hidden;\n  border: 1px solid var(--reca-line);\n  border-radius: 11px;\n  background:\n    linear-gradient(165deg, transparent 30%, rgba(255,180,95,.16)),\n    radial-gradient(circle at 60% 35%, rgba(185,255,102,.18), transparent 24%),\n    #111712;\n}\n.reca-tab-demo .reca-preview::before { content: \"\"; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, transparent 0 19px, rgba(255,255,255,.015) 19px 20px); }\n.reca-tab-demo .reca-preview::after { content: \"SEGMENT PREVIEW\"; position: absolute; left: 13px; bottom: 12px; color: rgba(231,238,232,.62); font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }\n.reca-tab-demo .reca-preview-orb { position: absolute; top: 50%; left: 50%; width: 46px; height: 46px; border: 1px solid rgba(185,255,102,.38); border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 35px rgba(185,255,102,.16); }\n.reca-tab-demo .reca-segment-video { width: 100%; min-height: 160px; max-height: 280px; border: 1px solid var(--reca-line); border-radius: 11px; background: #050706; object-fit: contain; }\n.reca-tab-demo .reca-inspector-note { margin-top: 13px; padding: 10px 11px; border-left: 2px solid var(--reca-amber); color: #818d84; background: rgba(255,180,95,.035); font-size: 8px; line-height: 1.6; }\n\n.reca-tab-demo .reca-empty { padding: 16px; border: 1px dashed var(--reca-line); border-radius: 10px; color: #667169; font: 9px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-empty-graph { width: min(440px, 70%); margin: 42px auto; text-align: center; }\n.reca-tab-demo .reca-empty-inspector { margin: 20px; }\n\n.reca-tab-demo .reca-final {\n  display: grid;\n  grid-template-columns: minmax(260px, .7fr) minmax(380px, 1.3fr);\n  margin: 0 22px 28px;\n  overflow: hidden;\n  border: 1px solid rgba(185, 255, 102, .22);\n  border-radius: 14px;\n  background: #0d120e;\n  box-shadow: 0 18px 60px rgba(0,0,0,.25);\n}\n.reca-tab-demo .reca-final-copy { padding: 26px; }\n.reca-tab-demo .reca-final-copy small { color: var(--reca-lime); font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; }\n.reca-tab-demo .reca-final-copy h2 { margin: 10px 0 8px; font-size: 22px; letter-spacing: -.035em; }\n.reca-tab-demo .reca-final-copy p { margin: 0; color: #78857b; font-size: 10px; line-height: 1.65; }\n.reca-tab-demo .reca-final video { width: 100%; height: 100%; min-height: 235px; object-fit: cover; background: #050706; }\n.reca-tab-demo .reca-final-placeholder { display: grid; min-height: 235px; place-items: center; color: #566158; background: repeating-linear-gradient(135deg, #090c0a 0 14px, #0c110d 14px 28px); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }\n.reca-tab-demo .reca-final.waiting { opacity: .36; filter: saturate(.3); }\n\n@keyframes reca-pulse { 50% { opacity: .35; transform: scale(1.02); } }\n\n@media (max-width: 980px) {\n  .reca-tab-demo .reca-workspace { grid-template-columns: 1fr; }\n  .reca-tab-demo .reca-graph-wrap { border-right: 0; border-bottom: 1px solid var(--reca-line); }\n  .reca-tab-demo .reca-inspector { min-height: 300px; }\n  .reca-tab-demo .reca-meta { grid-template-columns: repeat(3, 1fr); }\n  .reca-tab-demo .reca-meta > div:first-child { grid-column: span 2; }\n  .reca-tab-demo .reca-asset-grid { grid-template-columns: repeat(2, 1fr); }\n}\n\n@media (max-width: 660px) {\n  .reca-tab-demo .reca-topline { grid-template-columns: 1fr; }\n  .reca-tab-demo .reca-controls { justify-content: flex-start; }\n  .reca-tab-demo .reca-stagebar { overflow-x: auto; grid-template-columns: repeat(5, 90px); }\n  .reca-tab-demo .reca-meta { grid-template-columns: 1fr 1fr; }\n  .reca-tab-demo .reca-meta > div:first-child { grid-column: 1 / -1; }\n  .reca-tab-demo .reca-final { grid-template-columns: 1fr; margin: 0 12px 18px; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .reca-tab-demo *, .reca-tab-demo *::before, .reca-tab-demo *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; }\n}\n";
    const RECA_DEMO_SOURCE = {"runId":"wukong_huaguo_oath","title":"Flower–Fruit Mountain Oath","subtitle":"ReCA Director · 4 parallel shots · 10 serial leaves","resolution":"1920 × 1080","duration":"90.2s","models":"gpt-image-2 + wan3.0-video","film":{"src":"https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4","poster":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23121711'/%3E%3Cstop offset='.55' stop-color='%233b4f35'/%3E%3Cstop offset='1' stop-color='%23c48a4c'/%3E%3C/linearGradient%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.008' numOctaves='3'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Cpath d='M0 560L260 290 420 450 610 170 805 430 1000 250 1200 510V675H0Z' fill='%23080d0a' opacity='.8'/%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.08'/%3E%3Ctext x='60' y='90' fill='%23d5f7c6' font-family='monospace' font-size='22'%3ERECA FINAL FILM / WUKONG%3C/text%3E%3C/svg%3E"},"assets":[{"id":"wukong","label":"Wukong portrait","type":"character","tone":"lime"},{"id":"huaguo_cliff","label":"Huaguo cliff","type":"location","tone":"cyan"},{"id":"oath_banner","label":"Oath banner","type":"prop","tone":"amber"},{"id":"sunset_clouds","label":"Sunset cloud sea","type":"atmosphere","tone":"violet"}],"shots":[{"id":"shot01_cliff_gaze","title":"Cliff gaze","goal":"Establish Wukong above the cloud sea before the oath.","duration":"24s","segments":[{"id":"shot01_cliff_gaze_00","label":"Wide reveal","mode":"R2V","duration":"12s","score":"0.91","prompt":"A slow aerial push toward Wukong standing on the Flower–Fruit Mountain cliff. Sunset cloud sea, banner cloth moving in the wind, restrained cinematic motion."},{"id":"shot01_cliff_gaze_01","label":"Resolve to profile","mode":"I2V","duration":"12s","score":"0.87","prompt":"Continue from the wide reveal into a calm profile close-up. Keep armor, golden headband and sunset key light consistent with the shared portrait state."}]},{"id":"shot02_banner_raise","title":"Banner rises","goal":"Turn the oath banner into the scene's visual motif.","duration":"20s","segments":[{"id":"shot02_banner_raise_00","label":"Hands and staff","mode":"R2V","duration":"8s","score":"0.93","prompt":"Low angle detail: Wukong drives the staff into stone as the oath banner rises behind him. Sparks, dust and heavy cloth motion."},{"id":"shot02_banner_raise_01","label":"Banner crest","mode":"I2V","duration":"12s","score":"0.89","prompt":"The camera cranes upward with the banner until its crest fills the frame, then eases back to reveal the gathered monkeys below."}]},{"id":"shot03_oath_circle","title":"Oath circle","goal":"Build collective energy while preserving character identity.","duration":"26s","segments":[{"id":"shot03_oath_circle_00","label":"Circle enters","mode":"R2V","duration":"8s","score":"0.86","prompt":"A circular dolly reveals the companions stepping into an oath circle around the planted staff. Preserve wardrobe and spatial continuity."},{"id":"shot03_oath_circle_01","label":"Hands converge","mode":"I2V","duration":"8s","score":"0.72","repair":true,"prompt":"Hands converge above the staff. The first render drifts on hand anatomy; ReCA branches to a repaired close-up with clearer silhouettes."},{"id":"shot03_oath_circle_02","label":"Energy pulse","mode":"I2V","duration":"10s","score":"0.94","prompt":"A gold energy pulse travels from the joined hands into the staff and across the rock floor, lighting every face in sequence."}]},{"id":"shot04_sky_vow","title":"Sky vow","goal":"Close on the shared vow and a final heroic silhouette.","duration":"20.2s","segments":[{"id":"shot04_sky_vow_00","label":"Cloud break","mode":"R2V","duration":"8s","score":"0.90","prompt":"The cloud ceiling breaks above the circle; warm light sweeps down the cliff while the camera rotates toward the open sky."},{"id":"shot04_sky_vow_01","label":"Hero silhouette","mode":"I2V","duration":"12.2s","score":"0.96","prompt":"End with Wukong and the banner in silhouette against the opened sky. Hold the final composition long enough for the title beat."}]}]};
    const STYLE_ID = 'dsh-reca-tab-plugin-demo/reca.css';
    const TONE_COLORS = ['#b9ff66', '#73d9e7', '#ffb45f', '#aa91ff'];
    
    function ensureStyles() {
      if (typeof document === 'undefined' || document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-reca-tab-plugin-demo';
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = RECA_CSS;
      document.head.appendChild(tag);
    }
    
    function durationSeconds(value) {
      const parsed = Number.parseFloat(String(value || '').replace(/s$/i, ''));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    
    function buildDemoSnapshot(source) {
      let flatIndex = 0;
      const shots = source.shots.map((shot, shotIndex) => ({
        id: shot.id,
        index: shotIndex,
        label: shot.title,
        storyGoal: shot.goal,
        durationS: durationSeconds(shot.duration),
        status: shotIndex === 0 ? 'done' : (shotIndex === 1 ? 'active' : 'pending'),
        segments: shot.segments.map((segment, segmentIndex) => {
          const index = flatIndex++;
          return {
            ...segment,
            index: segmentIndex,
            requestType: segment.mode,
            durationS: durationSeconds(segment.duration),
            status: index < 3 ? 'done' : (index === 3 ? 'active' : 'pending'),
            repairs: segment.repair ? [{ attempt: 1, strategy: 'continuity repair' }] : [],
            validations: [],
            videoUrl: null,
            posterUrl: null,
          };
        }),
      }));
      return {
        ...source,
        state: 'rendering',
        status: 'active',
        terminal: false,
        phase: 'rendering',
        progress: 68,
        stages: [
          { id: 'plan', label: 'Plan', status: 'done' },
          { id: 'assets', label: 'Assets', status: 'done' },
          { id: 'render', label: 'Render', status: 'active' },
          { id: 'validate', label: 'Validate', status: 'pending' },
          { id: 'concat', label: 'Concat', status: 'pending' },
        ],
        counts: {
          shots: shots.length,
          segments: flatIndex,
          completedSegments: 3,
          assets: source.assets.length,
          repairs: 1,
        },
        assets: source.assets.map((asset) => ({
          ...asset,
          kind: asset.type,
          status: 'done',
          imageUrl: null,
        })),
        shots,
      };
    }
    
    const RECA_DEMO = buildDemoSnapshot(RECA_DEMO_SOURCE);
    
    function flattenSegments(data) {
      return (data.shots || []).flatMap((shot, shotIndex) => (shot.segments || []).map((segment, segmentIndex) => ({
        ...segment,
        shotId: shot.id,
        shotTitle: shot.label || shot.title || shot.id,
        shotIndex,
        segmentIndex,
      })));
    }
    
    function visualSegmentStatus(segment) {
      if (segment.status === 'active') return 'running';
      if (segment.status === 'failed') return 'flagged';
      if (segment.status === 'done' && segment.repairs?.length) return 'repaired';
      return segment.status || 'pending';
    }
    
    function stateLabel(status) {
      return ({ pending: 'queued', active: 'rendering', running: 'rendering', failed: 'failed', flagged: 'flagged', repaired: 'repaired', done: 'ready' })[status] || status;
    }
    
    function durationLabel(value, fallback) {
      if (Number.isFinite(Number(value))) return `${Number(value)}s`;
      return fallback || 'duration pending';
    }
    
    function modeLabel(mode, runId) {
      if (!runId || mode === 'demo') return 'DEMO · waiting for a ReCA tool result';
      if (mode === 'connecting') return 'CONNECTING · locating Gateway run';
      if (mode === 'stale') return 'STALE · retrying Gateway';
      if (mode === 'error') return 'CONNECTION ERROR · retrying';
      return 'LIVE · Gateway execution graph';
    }
    
    function MetaItem({ label, value }) {
      return h('div', null, h('small', null, label), h('strong', null, value));
    }
    
    function RecaTabView({ useSession, sessionId, connection }) {
      ensureStyles();
      const runId = RecaTrace.useSessionRunId(useSession, sessionId);
      const trace = RecaTrace.useTraceSnapshot({ connection, runId, fallback: RECA_DEMO });
      const data = trace.snapshot || RECA_DEMO;
      const segments = React.useMemo(() => flattenSegments(data), [data]);
      const [selectedId, setSelectedId] = React.useState(null);
      const selected = segments.find((segment) => segment.id === selectedId) || segments[0] || null;
      const complete = data.status === 'done' || data.state === 'succeeded' || Boolean(data.film?.src);
      const progress = Number.isFinite(Number(data.progress)) ? Number(data.progress) : 0;
      const counts = data.counts || {
        shots: data.shots?.length || 0,
        segments: segments.length,
        completedSegments: segments.filter((segment) => segment.status === 'done').length,
        assets: data.assets?.length || 0,
        repairs: 0,
      };
    
      return h('section', {
        className: 'reca-tab-demo',
        'data-reca-demo': 'conversation-view',
        'data-reca-mode': trace.mode,
        'data-reca-run-id': runId || undefined,
      },
        h('header', { className: 'reca-topline' },
          h('div', null,
            h('div', { className: `reca-eyebrow reca-mode-${trace.mode}` }, h('span', { className: 'reca-live-dot' }), modeLabel(trace.mode, runId)),
            h('div', { className: 'reca-title-row' }, h('strong', null, data.title || `ReCA run ${data.runId}`), h('span', null, data.runId)),
          ),
          h('div', { className: 'reca-controls' },
            h('span', { className: `reca-connection-pill is-${trace.mode}` }, trace.mode === 'demo' ? 'DEMO DATA' : trace.mode.toUpperCase()),
            h('span', { className: 'reca-poll-note' }, runId ? 'poll 1.6s · no LLM' : 'start with reca_create_video'),
          ),
        ),
        trace.error ? h('div', { className: 'reca-poll-error', role: 'status' }, trace.error, ' · the last useful snapshot remains visible') : null,
        h('div', { className: 'reca-stagebar', 'aria-label': 'ReCA stages' },
          ...(data.stages || []).map((stage) => h('div', { className: `reca-stage ${stage.status || 'pending'}`, key: stage.id }, stage.label)),
        ),
        h('div', { className: 'reca-meta' },
          h(MetaItem, { label: 'Run', value: data.runId || 'waiting' }),
          h(MetaItem, { label: 'Progress', value: `${progress}% · ${data.phase || data.state || 'queued'}` }),
          h(MetaItem, { label: 'Plan', value: `${counts.shots} shots · ${counts.segments} segments` }),
          h(MetaItem, { label: 'Rendered', value: `${counts.completedSegments || 0}/${counts.segments || 0} · ${counts.repairs || 0} repairs` }),
          h(MetaItem, { label: 'Source', value: trace.mode === 'demo' ? 'embedded demo' : 'ReCA Gateway' }),
        ),
        h('section', { className: 'reca-assets' },
          h('div', { className: 'reca-section-label' }, h('span', null, 'Shared visual state'), h('em', null, `${counts.assets || 0} real plan assets`)),
          (data.assets || []).length
            ? h('div', { className: 'reca-asset-grid' },
              ...(data.assets || []).map((asset, index) => h('div', {
                className: `reca-asset ${asset.status || 'pending'}`,
                key: asset.id,
                style: {
                  '--asset-color': TONE_COLORS[index % TONE_COLORS.length],
                  ...(asset.imageUrl ? { '--asset-image': `url("${String(asset.imageUrl).replace(/"/g, '%22')}")` } : {}),
                },
              }, h('strong', null, asset.label), h('small', null, asset.kind || asset.type || 'asset'))),
            )
            : h('div', { className: 'reca-empty' }, 'Waiting for render_plan.json and shared assets from this run.'),
        ),
        h('div', { className: 'reca-workspace' },
          h('div', { className: 'reca-graph-wrap' },
            h('div', { className: 'reca-graph' },
              h('div', { className: `reca-root ${complete ? 'done' : ''}` },
                h('span', { className: 'orbit' }),
                h('small', null, `ROOT · ${(data.state || data.status || 'queued').toUpperCase()}`),
                h('strong', null, data.title || data.runId),
                h('span', null, data.story || data.subtitle || `${counts.shots} shots · ${counts.segments} segments`),
              ),
              h('div', { className: 'reca-trunk' }),
              (data.shots || []).length
                ? h('div', { className: 'reca-shot-grid', style: { '--shot-count': Math.max(1, data.shots.length) } },
                  ...(data.shots || []).map((shot, shotIndex) => h('section', { className: 'reca-shot', key: shot.id },
                    h('div', { className: `reca-shot-head is-${shot.status || 'pending'}` },
                      h('small', null, `SHOT ${String(shotIndex + 1).padStart(2, '0')} · ${durationLabel(shot.durationS, shot.duration)}`),
                      h('strong', null, shot.label || shot.title || shot.id),
                      h('span', null, `${shot.segments?.length || 0} serial segments · ${stateLabel(shot.status || 'pending')}`),
                    ),
                    h('div', { className: 'reca-chain' },
                      ...(shot.segments || []).map((segment, segmentIndex) => {
                        const status = visualSegmentStatus(segment);
                        return h('button', {
                          className: `reca-leaf ${status} ${selected?.id === segment.id ? 'selected' : ''}`,
                          key: segment.id,
                          type: 'button',
                          onClick: () => setSelectedId(segment.id),
                        },
                        h('span', { className: 'reca-leaf-index' }, String(segmentIndex + 1).padStart(2, '0')),
                        h('span', { className: 'reca-leaf-copy' },
                          h('strong', null, segment.label || segment.id),
                          h('small', null, `${segment.requestType || segment.mode || 'segment'} · ${durationLabel(segment.durationS, segment.duration)}`),
                        ),
                        h('span', { className: 'reca-node-state' }, stateLabel(status)));
                      }),
                    ),
                  )),
                )
                : h('div', { className: 'reca-empty reca-empty-graph' }, 'The run exists. Waiting for its narrative and render plan.'),
            ),
          ),
          h('aside', { className: 'reca-inspector' },
            selected ? h(React.Fragment, null,
              h('div', { className: 'reca-inspector-head' },
                h('div', { className: 'reca-inspector-kicker' }, 'Selected real segment'),
                h('h2', null, selected.label || selected.id),
                h('div', { className: 'reca-inspector-id' }, `${selected.shotTitle} / ${selected.id}`),
              ),
              h('div', { className: 'reca-inspector-body' },
                h('p', null, selected.prompt || selected.endState || 'The Gateway has not published this segment prompt yet.'),
                h('div', { className: 'reca-facts' },
                  h('span', null, selected.requestType || selected.mode || 'segment'),
                  h('span', null, durationLabel(selected.durationS, selected.duration)),
                  selected.score != null ? h('span', null, `validator ${Number(selected.score).toFixed(2)}`) : null,
                  selected.repairs?.length ? h('span', null, `${selected.repairs.length} repair branch`) : null,
                ),
                selected.videoUrl
                  ? h('video', { className: 'reca-segment-video', controls: true, preload: 'metadata', poster: selected.posterUrl || undefined, src: selected.videoUrl })
                  : h('div', { className: 'reca-preview', 'aria-label': 'segment preview pending' }, h('span', { className: 'reca-preview-orb' })),
                selected.repairs?.length
                  ? h('div', { className: 'reca-inspector-note' }, `ReCA recorded ${selected.repairs.length} repair attempt(s). The original segment remains visible in the execution trace.`)
                  : null,
              ),
            ) : h('div', { className: 'reca-empty reca-empty-inspector' }, 'Select a segment after the render plan becomes available.'),
          ),
        ),
        h('section', { className: `reca-final ${data.film?.src ? '' : 'waiting'}` },
          h('div', { className: 'reca-final-copy' },
            h('small', null, data.film?.src ? 'REAL FINAL ARTIFACT READY' : 'FINAL ARTIFACT · WAITING'),
            h('h2', null, data.film?.src ? 'The Gateway artifact is ready.' : 'The execution graph becomes the film.'),
            h('p', null, data.film?.src ? 'This URL is rewritten through the configured ReCA Gateway and belongs to the selected run.' : 'The final video unlocks after validation and concat reach the root node.'),
            h('div', { className: 'reca-facts' },
              h('span', null, `${counts.shots} shots`),
              h('span', null, `${counts.segments} segments`),
              h('span', null, `${counts.repairs || 0} repairs`),
            ),
          ),
          data.film?.src
            ? h('video', { controls: true, preload: 'metadata', poster: data.film.poster || undefined, src: data.film.src })
            : h('div', { className: 'reca-final-placeholder' }, 'run/final.mp4'),
        ),
      );
    }
    
    const inject = ['slots', 'connection'];
    
    function apply(ctx) {
      ensureStyles();
      ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'reca',
        order: 20,
        label: () => 'ReCA',
        inject: () => ({ connection: ctx.get('connection') }),
      }, RecaTabView));
    }
    
    exports.apply = apply;
    exports.inject = inject;
    exports.RecaTabView = RecaTabView;
    
    return module.exports;
  }
});
