window.__ModuleLoader__.load({
  id: "@reca-demo/dsh-details",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    if (!document.querySelector('style[data-plugin="reca-details-demo"]')) {
      const style = document.createElement('style');
      style.dataset.plugin = 'reca-details-demo';
      style.textContent = ".reca-details-panel {\n  --rd-bg: #0b0d10; --rd-panel: #11141a; --rd-line: #292e37; --rd-text: #ece9e1;\n  --rd-muted: #858b96; --rd-gold: #e1ae62; --rd-green: #63d99a; --rd-blue: #6fc6e6;\n  display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 320px;\n  overflow: hidden; color: var(--rd-text); background: var(--rd-bg);\n  font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n}\n.reca-details-panel * { box-sizing: border-box; }\n.reca-details-head { display: flex; flex: none; align-items: center; justify-content: space-between; height: 58px; padding: 0 16px; border-bottom: 1px solid var(--rd-line); }\n.reca-details-head small { display: block; color: var(--rd-gold); font: 700 8px/1.5 ui-monospace, monospace; letter-spacing: .16em; }\n.reca-details-head strong { font-size: 13px; font-weight: 580; }\n.reca-details-head button { width: 30px; height: 30px; border: 1px solid var(--rd-line); border-radius: 7px; color: #a9adb4; background: #15181e; cursor: pointer; font-size: 18px; }\n.reca-details-run { flex: none; padding: 14px 16px 13px; border-bottom: 1px solid var(--rd-line); background: radial-gradient(circle at 100% 0, #4f3c1d55, transparent 58%), var(--rd-panel); }\n.reca-details-runline { display: flex; justify-content: space-between; margin-bottom: 8px; font: 700 8px ui-monospace, monospace; letter-spacing: .12em; }\n.reca-details-runline span { color: var(--rd-green); }\n.reca-details-runline span.is-demo, .reca-details-runline span.is-connecting { color: var(--rd-gold); }\n.reca-details-runline span.is-stale, .reca-details-runline span.is-error { color: #ff7b72; }\n.reca-details-runline span i, .reca-details-panel footer i { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: var(--rd-green); box-shadow: 0 0 10px #63d99a; }\n.reca-details-runline b { color: var(--rd-gold); font-size: 11px; }\n.reca-details-run > strong { display: block; font-size: 13px; }\n.reca-details-run code { color: #737a85; font-size: 9px; }\n.reca-details-progress { height: 3px; margin: 11px 0; overflow: hidden; border-radius: 2px; background: #292d34; }\n.reca-details-progress i { display: block; height: 100%; background: linear-gradient(90deg, var(--rd-green), var(--rd-gold)); transition: width .3s; }\n.reca-details-stages { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }\n.reca-details-stages span { padding: 4px 2px; border: 1px solid #282c33; border-radius: 999px; color: #5d636d; text-align: center; font-size: 7px; }\n.reca-details-stages .done { border-color: #315c4a; color: var(--rd-green); }\n.reca-details-stages .active { border-color: #70552e; color: var(--rd-gold); background: #e1ae620b; }\n.reca-details-stages .failed { border-color: #753b3b; color: #ff7b72; background: #ff7b720b; }\n.reca-details-label { display: flex; flex: none; justify-content: space-between; padding: 10px 16px 7px; color: #747b86; font: 700 8px ui-monospace, monospace; letter-spacing: .13em; }\n.reca-details-label span:last-child { color: #555b64; letter-spacing: 0; }\n.reca-details-tree { flex: 1 1 270px; min-height: 190px; overflow: auto; padding: 0 9px 12px; }\n.reca-details-tree button { position: relative; display: grid; grid-template-columns: 13px minmax(0, 1fr) auto; gap: 7px; align-items: center; width: calc(100% - var(--depth) * 15px); min-height: 39px; margin: 0 0 4px calc(var(--depth) * 15px); padding: 5px 8px; border: 1px solid transparent; border-radius: 7px; color: #9ba1ab; text-align: left; background: transparent; cursor: pointer; }\n.reca-details-tree button:hover { background: #14171c; }\n.reca-details-tree button.selected { border-color: #795b31; color: var(--rd-text); background: #e1ae620c; }\n.reca-details-tree button .guide { position: absolute; left: -9px; top: -7px; width: 8px; height: 27px; border-left: 1px solid #343944; border-bottom: 1px solid #343944; }\n.reca-details-tree button[style*=\"--depth: 0\"] .guide { display: none; }\n.reca-details-dot { width: 7px; height: 7px; border: 1px solid #59606a; border-radius: 50%; }\n.reca-details-dot.is-done { border-color: var(--rd-green); background: var(--rd-green); }\n.reca-details-dot.is-active, .reca-details-dot.is-running { border-color: var(--rd-gold); background: var(--rd-gold); box-shadow: 0 0 8px #e1ae62; }\n.reca-details-dot.is-failed, .reca-details-dot.is-cancelled, .reca-details-dot.is-interrupted { border-color: #ff7b72; background: #ff7b72; }\n.reca-details-tree .copy { min-width: 0; }\n.reca-details-tree .copy small { display: block; color: #606772; font: 7px ui-monospace, monospace; }\n.reca-details-tree .copy strong { display: block; overflow: hidden; font-size: 10px; font-weight: 540; text-overflow: ellipsis; white-space: nowrap; }\n.reca-details-tree em { color: #737a84; font: normal 8px ui-monospace, monospace; }\n.reca-details-inspector { flex: none; padding: 0 14px 14px; border-top: 1px solid var(--rd-line); background: #0e1014; }\n.reca-details-inspector .reca-details-label { margin: 0 -14px; }\n.reca-details-preview { position: relative; height: 102px; overflow: hidden; border: 1px solid #303640; border-radius: 8px; background: linear-gradient(150deg, #182747, #76522b 62%, #101215); }\n.reca-details-preview .sun { position: absolute; right: 35px; top: 8px; width: 55px; height: 55px; border-radius: 50%; background: radial-gradient(circle, #ffe0a1, #e98b3b22 68%, transparent 70%); }\n.reca-details-preview .mountains { position: absolute; inset: 42px -10px -10px; transform: skewX(-15deg); background: #080a0d; clip-path: polygon(0 100%, 16% 30%, 29% 72%, 47% 0, 61% 74%, 78% 24%, 100% 86%, 100% 100%); }\n.reca-details-preview > b { position: absolute; left: 9px; top: 8px; color: #f3ddba; font: 8px ui-monospace, monospace; }\n.reca-details-preview > i { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 34px; height: 34px; transform: translate(-50%, -50%); border: 1px solid #fff6; border-radius: 50%; background: #0008; font-style: normal; }\n.reca-details-preview > video, .reca-details-preview > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }\n.reca-details-preview.has-media > b { padding: 3px 5px; border-radius: 4px; background: #090b0dcc; }\n.reca-details-inspector h3 { margin: 10px 0 3px; font-size: 13px; }\n.reca-details-inspector p { margin: 0; color: var(--rd-muted); font-size: 9px; line-height: 1.5; }\n.reca-details-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 10px; }\n.reca-details-facts span { padding: 6px; border: 1px solid #292e36; border-radius: 6px; color: #a0a6b0; font-size: 7px; }\n.reca-details-facts b { display: block; color: #5f6670; font: 7px ui-monospace, monospace; }\n.reca-details-panel footer { display: flex; flex: none; justify-content: space-between; padding: 9px 14px; border-top: 1px solid var(--rd-line); color: #676e78; font-size: 8px; }\n.reca-details-panel footer b { color: #9a7441; font-weight: 520; }\n";
      document.head.appendChild(style);
    }
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
    const React = require('react')
    const h = React.createElement
    
    // This remains visible before a session has produced a ReCA run_id. Once
    // reca_create_video/reca_start returns one, the same component switches to the
    // normalized snapshot delivered by the Harness Host trace proxy.
    const DEMO_TRACE = {
      runId: 'wukong_huaguo_oath',
      title: 'Flower-Fruit Mountain Oath',
      story: 'Recursive film plan, shared visual state, parallel shots and final concat.',
      state: 'rendering',
      status: 'active',
      phase: 'rendering',
      progress: 68,
      terminal: false,
      auditState: 'audit_running',
      videoState: 'rendering',
      stages: [
        { id: 'plan', label: 'Plan', status: 'done' },
        { id: 'assets', label: 'Assets', status: 'done' },
        { id: 'render', label: 'Render', status: 'active' },
        { id: 'validate', label: 'Validate', status: 'pending' },
        { id: 'concat', label: 'Concat', status: 'pending' },
      ],
      counts: { shots: 4, segments: 10, completedSegments: 5, assets: 7, repairs: 0 },
      nodes: [
        { id: 'root', depth: 0, kind: 'root', label: 'Flower-Fruit Mountain Oath', meta: '4 shots · 10 segments', status: 'active', detail: 'Recursive film plan, shared visual state, parallel shots and final concat.' },
        { id: 'plan', depth: 1, kind: 'phase', label: 'Narrative skeleton', meta: 'ready', status: 'done', detail: 'The planner locked four shots, ten serial leaves and their continuity transitions.' },
        { id: 'assets', depth: 1, kind: 'phase', label: 'Shared visual state', meta: '7 images', status: 'done', detail: 'Character identity, Flower-Fruit Mountain plate, staff and sunset palette.' },
        { id: 'shot01', depth: 1, kind: 'shot', label: 'Summit arrival', meta: '2 / 2', status: 'done', detail: 'Aerial approach into a controlled landing beat.' },
        { id: 's01a', depth: 2, kind: 'segment', label: 'Cloud approach', meta: '8.0s', status: 'done', detail: 'Wide aerial. First-frame identity anchor passed continuity validation.' },
        { id: 's01b', depth: 2, kind: 'segment', label: 'Landing beat', meta: '6.4s', status: 'done', detail: 'Tail-frame propagation keeps the staff silhouette and warm rim light.' },
        { id: 'shot02', depth: 1, kind: 'shot', label: 'Cliff gaze', meta: '3 / 4', status: 'active', detail: 'Emotional hinge rendered as four serial leaves.' },
        { id: 's02a', depth: 2, kind: 'segment', label: 'Shoulder turn', meta: 'ready', status: 'done', detail: 'Medium profile with cloth motion and a stable eye line.' },
        { id: 's02b', depth: 2, kind: 'segment', label: 'Oath close-up', meta: '72%', status: 'active', detail: 'Rendering a close-up against the mountain horizon; validator waits for the tail frame.' },
        { id: 's02c', depth: 2, kind: 'segment', label: 'Mountain answer', meta: 'queued', status: 'pending', detail: 'Scheduled after the current continuity tail is committed.' },
        { id: 'shot03', depth: 1, kind: 'shot', label: 'Monkeys gather', meta: 'queued', status: 'pending', detail: 'Crowd response and kinetic camera sweep.' },
        { id: 'shot04', depth: 1, kind: 'shot', label: 'Oath tableau', meta: 'queued', status: 'pending', detail: 'Final crane-out, validation and concat.' },
      ],
      film: { src: null, poster: null },
    }
    
    function nodeType(node) {
      return String(node?.kind || 'node').replace(/[_-]+/g, ' ').toUpperCase()
    }
    
    function Dot({ status }) {
      return h('i', { className: `reca-details-dot is-${status}` })
    }
    
    function Preview({ node }) {
      const videoUrl = node?.videoUrl || null
      const imageUrl = node?.posterUrl || node?.imageUrl || null
      return h('div', { className: `reca-details-preview${videoUrl || imageUrl ? ' has-media' : ''}` },
        videoUrl
          ? h('video', { src: videoUrl, poster: node.posterUrl || undefined, controls: true, muted: true, preload: 'metadata' })
          : imageUrl
            ? h('img', { src: imageUrl, alt: node.label || 'ReCA artifact' })
            : h(React.Fragment, null, h('span', { className: 'sun' }), h('span', { className: 'mountains' })),
        h('b', null, nodeType(node)),
        !videoUrl && h('i', null, imageUrl ? '◎' : '▶'),
      )
    }
    
    function modeCopy(mode) {
      if (mode === 'live') return 'LIVE RUN'
      if (mode === 'connecting') return 'CONNECTING'
      if (mode === 'stale') return 'STALE TRACE'
      if (mode === 'error') return 'TRACE ERROR'
      return 'DEMO TRACE'
    }
    
    function gatewayCopy(mode) {
      if (mode === 'live') return 'Gateway synced'
      if (mode === 'connecting') return 'Connecting to Gateway'
      if (mode === 'stale') return 'Using last Gateway snapshot'
      if (mode === 'error') return 'Gateway unavailable'
      return 'Demo data · waiting for run_id'
    }
    
    function RecaDetailsPanel({ closePanel, connection, useSession, sessionId }) {
      const runId = RecaTrace.useSessionRunId(useSession, sessionId)
      const trace = RecaTrace.useTraceSnapshot({
        connection,
        runId,
        fallback: DEMO_TRACE,
        intervalMs: 1600,
      })
      const snapshot = trace.snapshot || DEMO_TRACE
      const nodes = Array.isArray(snapshot.nodes) && snapshot.nodes.length > 0 ? snapshot.nodes : DEMO_TRACE.nodes
      const stages = Array.isArray(snapshot.stages) && snapshot.stages.length > 0 ? snapshot.stages : DEMO_TRACE.stages
      const counts = snapshot.counts || DEMO_TRACE.counts
      const [selected, setSelected] = React.useState('s02b')
      const preferred = nodes.find((item) => item.status === 'active' && item.kind === 'segment')
        || nodes.find((item) => item.status === 'active')
        || nodes[0]
      const node = nodes.find((item) => item.id === selected) || preferred
      const progress = Number.isFinite(Number(snapshot.progress)) ? Number(snapshot.progress) : 0
      const displayRunId = trace.runId || snapshot.runId
      const mode = trace.mode || 'demo'
    
      return h('aside', {
        className: `reca-details-panel is-${mode}`,
        'data-reca-surface': 'details',
        'data-reca-mode': mode,
        'data-reca-run-id': trace.runId || undefined,
      },
      h('header', { className: 'reca-details-head' },
        h('div', null, h('small', null, 'RECA DIRECTOR'), h('strong', null, 'Execution details')),
        h('button', { type: 'button', onClick: closePanel, title: 'Close ReCA details' }, '×'),
      ),
      h('section', { className: 'reca-details-run' },
        h('div', { className: 'reca-details-runline' },
          h('span', { className: `is-${mode}` }, h('i'), ` ${modeCopy(mode)}`),
          h('b', null, `${progress}%`),
        ),
        h('strong', null, snapshot.title || `ReCA run ${displayRunId}`),
        h('code', null, displayRunId),
        h('div', { className: 'reca-details-progress' }, h('i', { style: { width: `${Math.max(0, Math.min(100, progress))}%` } })),
        h('div', { className: 'reca-details-stages' }, stages.map((stage) =>
          h('span', { key: stage.id, className: stage.status === 'done' ? 'done' : stage.status === 'active' ? 'active' : stage.status === 'failed' ? 'failed' : '' }, stage.label),
        )),
      ),
      h('div', { className: 'reca-details-label' }, h('span', null, 'EXECUTION TREE'), h('span', null, `${nodes.length} nodes`)),
      h('nav', { className: 'reca-details-tree', 'aria-label': 'ReCA execution tree' }, nodes.map((item) =>
        h('button', {
          key: item.id,
          type: 'button',
          className: `${item.id === node?.id ? 'selected' : ''}`,
          style: { '--depth': item.depth || 0 },
          onClick: () => setSelected(item.id),
        },
        h('span', { className: 'guide' }), h(Dot, { status: item.status }),
        h('span', { className: 'copy' }, h('small', null, nodeType(item)), h('strong', null, item.label)),
        h('em', null, item.meta)),
      )),
      node && h('section', { className: 'reca-details-inspector' },
        h('div', { className: 'reca-details-label' }, h('span', null, 'NODE INSPECTOR'), h('span', null, node.status)),
        h(Preview, { node }),
        h('h3', null, node.label), h('p', null, node.detail || 'No node detail published yet.'),
        h('div', { className: 'reca-details-facts' },
          h('span', null, h('b', null, 'SHOTS'), String(counts.shots ?? 0)),
          h('span', null, h('b', null, 'SEGMENTS'), `${counts.completedSegments ?? 0} / ${counts.segments ?? 0}`),
          h('span', null, h('b', null, 'AUDIT'), snapshot.auditState || 'pending'),
        ),
      ),
      h('footer', null,
        h('span', { title: trace.error || undefined }, h('i'), ` ${gatewayCopy(mode)}`),
        h('b', null, mode === 'demo' ? 'DEMO · no session run' : `${snapshot.phase || snapshot.state} · session bound`),
      ))
    }
    
    exports.inject = ['slots', 'layout', 'connection']
    exports.apply = function apply(ctx) {
      ctx.slots.inject('details', () => ctx.slots.register({
        name: 'details',
        // `details` is a single slot already occupied by ui-conversation at 0.
        // Lowest priority renders, so this showcase intentionally shadows it.
        priority: -20,
        inject: () => ({
          closePanel: () => ctx.layout.closeDetails(),
          connection: ctx.connection,
        }),
      }, RecaDetailsPanel))
    
      window.setTimeout(() => {
        try { ctx.layout.openDetails() } catch { /* the next native details action opens it */ }
      }, 600)
    }
    
    return module.exports;
  }
});
