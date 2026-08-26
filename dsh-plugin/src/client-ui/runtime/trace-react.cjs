'use strict'

const TRACE_RPC_CHANNEL = '/reca-trace'
const RUN_CACHE_PREFIX = 'reca-trace:binding:'
const EMPTY_SNAPSHOT = null
const RUN_ID_RE = /^[A-Za-z0-9_-]{6,128}$/
const RUN_SOURCE_TOOLS = new Set(['reca_create_video', 'reca_start', 'reca_resume'])
const legacyBindings = new Map()
const serverStoreRegistry = new WeakMap()

function cleanIdentifier(value, maximum = 256) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text && text.length <= maximum && !/[\u0000-\u001f\u007f]/.test(text) ? text : null
}

function latestRunBindingFromConversation(snapshot, sessionId) {
  const boundSessionId = cleanIdentifier(sessionId)
  if (!boundSessionId) return null
  let latest = null
  for (const node of Array.isArray(snapshot?.nodes) ? snapshot.nodes : []) {
    const tool = typeof node?.call?.name === 'string' ? node.call.name : ''
    const seq = Number(node?.seq)
    if (node?.kind !== 'tool-result' || node.isError || !RUN_SOURCE_TOOLS.has(tool)) continue
    const runId = RecaTraceAdapter.extractRunId(node.content)
    if (!RUN_ID_RE.test(runId || '') || !Number.isFinite(seq) || seq < 0) continue
    if (!latest || seq >= latest.source.seq) {
      latest = {
        gatewayInstance: null,
        sessionId: boundSessionId,
        runId,
        source: { kind: 'tool-result', seq, tool },
        debug: false,
      }
    }
  }
  return latest
}

function latestRunIdFromConversation(snapshot) {
  let latestSeq = -1
  let latestRunId = null
  for (const node of Array.isArray(snapshot?.nodes) ? snapshot.nodes : []) {
    const tool = typeof node?.call?.name === 'string' ? node.call.name : ''
    const seq = Number(node?.seq)
    if (node?.kind !== 'tool-result' || node.isError || !RUN_SOURCE_TOOLS.has(tool)) continue
    const runId = RecaTraceAdapter.extractRunId(node.content)
    if (RUN_ID_RE.test(runId || '') && Number.isFinite(seq) && seq >= latestSeq) {
      latestSeq = seq
      latestRunId = runId
    }
  }
  return latestRunId
}

function cacheKey(gatewayInstance, sessionId) {
  return `${RUN_CACHE_PREFIX}${encodeURIComponent(gatewayInstance)}:${encodeURIComponent(sessionId)}`
}

function validStoredBinding(value, expectedKey) {
  if (!value || typeof value !== 'object' || value.debug === true) return null
  const gatewayInstance = cleanIdentifier(value.gatewayInstance)
  const sessionId = cleanIdentifier(value.sessionId)
  const runId = cleanIdentifier(value.runId, 128)
  const source = value.source && typeof value.source === 'object' ? value.source : {}
  const seq = Number(source.seq)
  const tool = typeof source.tool === 'string' ? source.tool : ''
  if (!gatewayInstance || !sessionId || !RUN_ID_RE.test(runId || '')) return null
  if (!Number.isFinite(seq) || seq < 0 || !RUN_SOURCE_TOOLS.has(tool)) return null
  if (expectedKey && cacheKey(gatewayInstance, sessionId) !== expectedKey) return null
  return {
    gatewayInstance,
    sessionId,
    runId,
    source: { kind: 'cache-window', seq, tool },
    debug: false,
    storedAt: Number(value.storedAt) || 0,
  }
}

function cachedRunBinding(sessionId) {
  const wantedSession = cleanIdentifier(sessionId)
  if (!wantedSession || typeof sessionStorage === 'undefined') return null
  let latest = null
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (typeof key !== 'string' || !key.startsWith(RUN_CACHE_PREFIX)) continue
      let parsed
      try { parsed = JSON.parse(sessionStorage.getItem(key) || '') } catch { continue }
      const binding = validStoredBinding(parsed, key)
      if (binding?.sessionId === wantedSession && (!latest || binding.storedAt >= latest.storedAt)) {
        latest = binding
      }
    }
  } catch {
    return null
  }
  return latest
}

function rememberRunBinding(binding) {
  if (binding?.debug || typeof sessionStorage === 'undefined') return
  const gatewayInstance = cleanIdentifier(binding?.gatewayInstance)
  const sessionId = cleanIdentifier(binding?.sessionId)
  const runId = cleanIdentifier(binding?.runId, 128)
  const seq = Number(binding?.source?.seq)
  const tool = typeof binding?.source?.tool === 'string' ? binding.source.tool : ''
  if (!gatewayInstance || !sessionId || !RUN_ID_RE.test(runId || '')) return
  if (!Number.isFinite(seq) || seq < 0 || !RUN_SOURCE_TOOLS.has(tool)) return
  try {
    sessionStorage.setItem(cacheKey(gatewayInstance, sessionId), JSON.stringify({
      gatewayInstance,
      sessionId,
      runId,
      source: { kind: 'tool-result', seq, tool },
      debug: false,
      storedAt: Date.now(),
    }))
  } catch { /* optional window-gap cache */ }
}

function forgetRunBinding(binding) {
  const sessionId = cleanIdentifier(binding?.sessionId)
  if (!sessionId || typeof sessionStorage === 'undefined') return
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index)
      if (typeof key !== 'string' || !key.startsWith(RUN_CACHE_PREFIX)) continue
      let parsed
      try { parsed = JSON.parse(sessionStorage.getItem(key) || '') } catch { continue }
      const cached = validStoredBinding(parsed, key)
      if (cached?.sessionId === sessionId && cached.runId === binding?.runId) {
        sessionStorage.removeItem(key)
      }
    }
  } catch { /* optional window-gap cache */ }
}

function explicitRunBinding(sessionId) {
  const boundSessionId = cleanIdentifier(sessionId)
  if (!boundSessionId || typeof window === 'undefined') return null
  const direct = typeof window.__RECA_RUN_ID__ === 'string' ? window.__RECA_RUN_ID__.trim() : ''
  const configured = RUN_ID_RE.test(direct)
    ? direct
    : RecaTraceAdapter.extractRunId(window.__RECA_RUN_ID__)
  if (RUN_ID_RE.test(configured || '')) {
    return {
      gatewayInstance: null,
      sessionId: boundSessionId,
      runId: configured,
      source: { kind: 'debug-override', seq: null, tool: 'debug-override' },
      debug: true,
    }
  }
  try {
    const query = new URLSearchParams(window.location.search).get('reca_run_id') || ''
    const runId = RUN_ID_RE.test(query) ? query : RecaTraceAdapter.extractRunId(query)
    return RUN_ID_RE.test(runId || '') ? {
      gatewayInstance: null,
      sessionId: boundSessionId,
      runId,
      source: { kind: 'debug-override', seq: null, tool: 'debug-override' },
      debug: true,
    } : null
  } catch { return null }
}

function stableBinding(binding) {
  if (!binding?.runId) return binding
  if (binding.gatewayInstance != null && !cleanIdentifier(binding.gatewayInstance)) return null
  const sessionId = cleanIdentifier(binding.sessionId)
  const runId = cleanIdentifier(binding.runId, 128)
  const debug = binding.debug === true
  const source = binding.source && typeof binding.source === 'object' ? binding.source : {}
  const seq = Number(source.seq)
  const tool = typeof source.tool === 'string' ? source.tool : ''
  if (!sessionId || !RUN_ID_RE.test(runId || '')) return null
  if (debug) {
    if (source.kind !== 'debug-override') return null
  } else if (!['tool-result', 'cache-window'].includes(source.kind)
      || !RUN_SOURCE_TOOLS.has(tool)
      || !Number.isFinite(seq)
      || seq < 0) {
    return null
  }
  return {
    gatewayInstance: cleanIdentifier(binding.gatewayInstance),
    sessionId,
    runId,
    source: {
      kind: source.kind,
      seq: debug ? null : seq,
      tool: debug ? 'debug-override' : tool,
    },
    debug,
  }
}

function useSessionRunBinding(useSession, sessionId) {
  const selectBinding = React.useCallback(
    (snapshot) => latestRunBindingFromConversation(snapshot, sessionId),
    [sessionId],
  )
  const detected = useSession(selectBinding)
  const debug = explicitRunBinding(sessionId)
  const cached = !debug && !detected ? cachedRunBinding(sessionId) : null
  return React.useMemo(
    () => stableBinding(debug || detected || cached || {
      gatewayInstance: null,
      sessionId: cleanIdentifier(sessionId),
      runId: null,
      source: { kind: 'none', seq: null, tool: null },
      debug: false,
    }),
    [
      debug?.runId,
      detected?.runId,
      detected?.source?.seq,
      cached?.gatewayInstance,
      cached?.runId,
      cached?.source?.seq,
      sessionId,
    ],
  )
}

function useSessionRunId(useSession, sessionId) {
  const binding = useSessionRunBinding(useSession, sessionId)
  if (binding?.runId) legacyBindings.set(binding.runId, binding)
  return binding?.runId || null
}

function useOverlayRunBinding(useSessions, resolveSession) {
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
  const detected = latestRunBindingFromConversation(snapshot, sessionId)
  const debug = explicitRunBinding(sessionId)
  const cached = !debug && !detected ? cachedRunBinding(sessionId) : null
  return React.useMemo(
    () => stableBinding(debug || detected || cached || {
      gatewayInstance: null,
      sessionId: cleanIdentifier(sessionId),
      runId: null,
      source: { kind: 'none', seq: null, tool: null },
      debug: false,
    }),
    [
      debug?.runId,
      detected?.runId,
      detected?.source?.seq,
      cached?.gatewayInstance,
      cached?.runId,
      cached?.source?.seq,
      sessionId,
    ],
  )
}

function useOverlayRunId(useSessions, resolveSession) {
  const binding = useOverlayRunBinding(useSessions, resolveSession)
  if (binding?.runId) legacyBindings.set(binding.runId, binding)
  return { runId: binding?.runId || null, sessionId: binding?.sessionId || null, binding }
}

function keepInput(previous, incoming, key) {
  return incoming && incoming[key] !== undefined ? incoming[key] : previous?.[key]
}

function traceStoreRegistry() {
  if (typeof window === 'undefined') return serverStoreRegistry
  if (!(window.__RECA_TRACE_POLL_STORES__ instanceof WeakMap)) {
    window.__RECA_TRACE_POLL_STORES__ = new WeakMap()
  }
  return window.__RECA_TRACE_POLL_STORES__
}

function storesForConnection(connection) {
  const registry = traceStoreRegistry()
  if (!registry.has(connection)) registry.set(connection, new Map())
  return registry.get(connection)
}

function bindingKey(binding) {
  return JSON.stringify([
    binding.gatewayInstance || 'unresolved',
    binding.sessionId,
    binding.runId,
    binding.source?.seq,
    binding.source?.tool,
    binding.debug === true,
  ])
}

function rpcFailure(error, fallback = 'ReCA trace RPC failed') {
  const details = error?.details && typeof error.details === 'object' ? error.details : {}
  const status = Number(details.httpStatus ?? error?.httpStatus ?? error?.status)
  return {
    message: error?.message || fallback,
    code: error?.code || 'internal',
    httpStatus: Number.isInteger(status) ? status : undefined,
    upstreamCode: details.upstreamCode ?? error?.upstreamCode,
    gatewayInstance: cleanIdentifier(
      details.gatewayInstance ?? details.gateway_instance_id ?? error?.gatewayInstance,
    ),
  }
}

function createTraceStore(connection, initialBinding, intervalMs, removeStore) {
  let binding = stableBinding(initialBinding)
  let view = {
    snapshot: null,
    mode: 'connecting',
    error: null,
    errorCode: null,
    httpStatus: null,
    upstreamCode: null,
    fetchedAt: null,
    binding,
  }
  let cached = {}
  let events = []
  let timer = null
  let controller = null
  let running = false
  const listeners = new Set()
  const timerHost = typeof window === 'undefined' ? globalThis : window

  const publish = (next) => {
    view = next
    for (const listener of [...listeners]) listener()
  }
  const schedule = () => {
    if (running) timer = timerHost.setTimeout(refresh, intervalMs)
  }
  const stopAsRunNotFound = (failure) => {
    const gatewayInstance = failure.gatewayInstance || binding.gatewayInstance
    binding = { ...binding, gatewayInstance }
    running = false
    cached = {}
    events = []
    forgetRunBinding(binding)
    publish({
      ...view,
      mode: 'run-not-found',
      error: failure.message,
      errorCode: 'run-not-found',
      httpStatus: failure.httpStatus ?? null,
      upstreamCode: failure.upstreamCode ?? null,
      binding,
    })
  }
  const refresh = async () => {
    if (!running || controller) return
    controller = new AbortController()
    try {
      const result = await connection.rpc.call(
        TRACE_RPC_CHANNEL,
        'snapshot',
        {
          gatewayInstance: binding.gatewayInstance,
          gateway_instance_id: binding.gatewayInstance,
          sessionId: binding.sessionId,
          runId: binding.runId,
          source: binding.source,
          debug: binding.debug === true,
        },
        controller.signal,
      )
      if (!result?.ok) {
        const failure = rpcFailure(result?.error)
        if (failure.code === 'run-not-found') {
          stopAsRunNotFound(failure)
          return
        }
        throw Object.assign(new Error(failure.message), failure)
      }
      const incoming = result.value || {}
      if (incoming.gatewayInstance != null && incoming.gateway_instance_id != null
          && incoming.gatewayInstance !== incoming.gateway_instance_id) {
        throw Object.assign(new Error('ReCA trace snapshot returned conflicting Gateway identities'), {
          code: 'gateway-contract',
        })
      }
      const gatewayInstance = cleanIdentifier(
        incoming.gatewayInstance ?? incoming.gateway_instance_id,
      )
      if (!gatewayInstance) throw new Error('ReCA trace snapshot omitted gateway_instance_id')
      if (binding.gatewayInstance && binding.gatewayInstance !== gatewayInstance) {
        stopAsRunNotFound({
          message: 'ReCA Gateway instance changed; the run binding is no longer valid',
          code: 'run-not-found',
          gatewayInstance,
        })
        return
      }
      binding = { ...binding, gatewayInstance }
      rememberRunBinding(binding)
      events = RecaTraceAdapter.mergeTraceEvents(events, incoming.events)
      const inputs = {
        ...incoming,
        runId: binding.runId,
        events,
        artifacts: keepInput(cached, incoming, 'artifacts'),
        renderPlan: keepInput(cached, incoming, 'renderPlan'),
        audit: keepInput(cached, incoming, 'audit'),
        request: keepInput(cached, incoming, 'request'),
        runReport: keepInput(cached, incoming, 'runReport'),
      }
      cached = inputs
      const snapshot = RecaTraceAdapter.normalizeRecaTraceSnapshot(inputs)
      publish({
        snapshot,
        mode: binding.debug ? 'debug' : 'live',
        error: null,
        errorCode: null,
        httpStatus: null,
        upstreamCode: null,
        fetchedAt: incoming.fetchedAt || Date.now(),
        binding,
      })
      if (snapshot.terminal) running = false
    } catch (error) {
      if (running && error?.name !== 'AbortError') {
        const failure = rpcFailure(error, error instanceof Error ? error.message : String(error))
        publish({
          ...view,
          mode: view.snapshot ? 'stale' : 'error',
          error: failure.message,
          errorCode: failure.code,
          httpStatus: failure.httpStatus ?? null,
          upstreamCode: failure.upstreamCode ?? null,
          binding,
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
      if (!running && !view.snapshot?.terminal && view.mode !== 'run-not-found') {
        running = true
        void refresh()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          running = false
          if (timer) timerHost.clearTimeout(timer)
          timer = null
          if (controller) controller.abort()
          removeStore?.()
        }
      }
    },
  }
}

function normalizeTraceBinding(binding, runId) {
  if (binding?.runId) return stableBinding(binding)
  const legacy = typeof runId === 'string' ? legacyBindings.get(runId) : null
  return legacy ? stableBinding(legacy) : null
}

function resolveTraceStore(connection, binding, intervalMs) {
  if (!binding?.runId || !binding?.sessionId || !connection?.rpc) return null
  const stores = storesForConnection(connection)
  const key = bindingKey(binding)
  if (!stores.has(key)) {
    let store
    store = createTraceStore(connection, binding, intervalMs, () => {
      if (stores.get(key) === store) stores.delete(key)
    })
    stores.set(key, store)
  }
  return stores.get(key)
}

function useTraceSnapshot({
  connection,
  binding: requestedBinding,
  runId,
  fallback,
  intervalMs = 1600,
  active = true,
  visible = true,
}) {
  const binding = normalizeTraceBinding(requestedBinding, runId)
  const key = binding?.runId ? bindingKey(binding) : ''
  const store = React.useMemo(
    () => resolveTraceStore(connection, binding, intervalMs),
    [connection, key, intervalMs],
  )
  const enabled = active !== false && visible !== false
  const subscribe = React.useCallback(
    (listener) => enabled && store ? store.subscribe(listener) : () => {},
    [enabled, store],
  )
  const getSnapshot = React.useCallback(
    () => store ? store.getSnapshot() : null,
    [store],
  )
  const view = React.useSyncExternalStore(subscribe, getSnapshot, () => null)
  const resolvedRunId = binding?.runId || (typeof runId === 'string' ? runId : null)
  if (!store || !view) {
    return {
      snapshot: fallback,
      mode: resolvedRunId ? 'error' : 'idle',
      error: null,
      errorCode: resolvedRunId ? 'unbound-run' : null,
      httpStatus: null,
      upstreamCode: null,
      fetchedAt: null,
      runId: resolvedRunId,
      binding,
    }
  }
  return { ...view, snapshot: view.snapshot || fallback, runId: resolvedRunId, binding: view.binding || binding }
}

module.exports = {
  cachedRunBinding,
  forgetRunBinding,
  latestRunBindingFromConversation,
  latestRunIdFromConversation,
  rememberRunBinding,
  useOverlayRunBinding,
  useOverlayRunId,
  useSessionRunBinding,
  useSessionRunId,
  useTraceSnapshot,
  // Exported for deterministic offline contract tests; surfaces do not call it.
  createTraceStore,
}
