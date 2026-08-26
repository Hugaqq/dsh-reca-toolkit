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
