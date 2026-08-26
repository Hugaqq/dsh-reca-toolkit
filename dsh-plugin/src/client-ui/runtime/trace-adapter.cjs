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

  const rootDetail = cleanText(request.story || status.error || `ReCA run ${runId}`)
  const nodes = [{
    id: 'root', parentId: null, depth: 0, kind: 'root',
    label: storyTitle(request.story, runId), status: rootStatus,
    meta: `${shotCount} shots · ${segmentCount} segments`,
    summary: shorten(rootDetail, 160),
    detail: rootDetail,
    story: cleanText(request.story || request.narrative),
  }, {
    id: 'plan', parentId: 'root', depth: 1, kind: 'phase',
    label: 'Narrative & render plan', status: planStageStatus,
    meta: planReady ? `${shotCount} shots` : recaStage,
    summary: planReady ? 'Render plan loaded.' : 'Waiting for render_plan.json.',
    detail: planReady ? 'Render plan loaded from the real run artifact.' : 'Waiting for render_plan.json.',
  }, {
    id: 'assets', parentId: 'root', depth: 1, kind: 'phase',
    label: 'Shared visual state', status: assetsStageStatus,
    meta: `${imageAssetCount} assets`,
    summary: 'Shared portraits, locations, props, and anchors.',
    detail: 'Portrait, location, prop, and anchor images shared across shots.',
  }]

  for (const asset of assetRows) {
    nodes.push({
      id: `asset:${asset.id}`, parentId: 'assets', depth: 2, kind: 'asset',
      label: asset.label, status: asset.status, meta: asset.kind,
      summary: shorten(asset.prompt, 120),
      detail: asset.prompt,
      prompt: asset.prompt,
      imageUrl: asset.imageUrl,
    })
  }

  for (const shot of normalizedShots) {
    nodes.push({
      id: shot.id, parentId: 'root', depth: 1, kind: 'shot', label: shot.label,
      status: shot.status, meta: `${shot.segments.length} segments`,
      summary: shorten(shot.storyGoal || shot.visualIntent, 140),
      detail: shot.storyGoal || shot.visualIntent,
      storyGoal: shot.storyGoal,
      visualIntent: shot.visualIntent,
      startState: shot.startState,
      endState: shot.endState,
      durationS: shot.durationS,
    })
    if (shot.anchor) {
      nodes.push({
        id: `anchor:${shot.anchor.id}`, parentId: shot.id, depth: 2, kind: 'anchor',
        label: 'Start anchor', status: shot.anchor.status, meta: shot.anchor.id,
        summary: shorten(shot.anchor.prompt, 120),
        detail: shot.anchor.prompt,
        prompt: shot.anchor.prompt,
        imageUrl: shot.anchor.imageUrl,
      })
    }
    for (const segment of shot.segments) {
      nodes.push({
        id: segment.id, parentId: shot.id, depth: 2, kind: 'segment',
        label: segment.label, status: segment.status,
        meta: segment.durationS != null ? `${segment.durationS}s` : segment.requestType,
        summary: shorten(segment.prompt || segment.endState, 160),
        detail: segment.prompt || segment.endState,
        prompt: segment.prompt,
        endState: segment.endState,
        requestType: segment.requestType,
        validation: segment.validation,
        validations: segment.validations,
        repairs: segment.repairs,
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
          summary: shorten(repair.detail, 160),
          detail: repair.detail,
          strategy: repair.strategy,
          attempt: repair.attempt || repairIndex + 1,
        })
      })
    }
  }

  nodes.push({
    id: 'concat', parentId: 'root', depth: 1, kind: 'artifact',
    label: 'Final concat', status: concatStageStatus,
    meta: finalReady ? 'final.mp4 ready' : 'waiting',
    summary: finalReady ? 'Final video artifact ready.' : 'Waiting for render and validation.',
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
