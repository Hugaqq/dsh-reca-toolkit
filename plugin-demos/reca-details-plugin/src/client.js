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
