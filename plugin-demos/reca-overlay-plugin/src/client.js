const React = require('react')
const { Fragment, useRef, useState } = React
const h = React.createElement

const PLUGIN_ID = '@reca-demo/dsh-overlay'
const WIDTHS = [388, 480, 620]

const poster = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#172554"/><stop offset=".45" stop-color="#713f12"/><stop offset="1" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="sun"><stop stop-color="#fde68a"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#sky)"/>
  <circle cx="470" cy="92" r="95" fill="url(#sun)"/>
  <path d="M0 260L95 172l70 67 85-130 90 151 78-92 102 100 120-53v145H0z" fill="#05070b"/>
  <path d="M279 197c17-28 34-34 51-14l-8 28 15 52h-66l18-48z" fill="#f59e0b" opacity=".78"/>
  <path d="M307 177l23-39 5 5-16 43z" stroke="#fde68a" stroke-width="4"/>
  <text x="28" y="328" fill="#fff" font-size="21" font-family="sans-serif" opacity=".9">SHOT 02 · CLIFF GAZE · 12.0s</text>
</svg>`)}`

const SAMPLE = {
  runId: 'wukong_huaguo_oath',
  title: 'Flower-Fruit Mountain Oath',
  state: 'rendering',
  progress: 68,
  stages: [
    { id: 'plan', label: 'Plan', status: 'done' },
    { id: 'assets', label: 'Assets', status: 'done' },
    { id: 'render', label: 'Render', status: 'active' },
    { id: 'validate', label: 'Validate', status: 'pending' },
    { id: 'concat', label: 'Concat', status: 'pending' },
  ],
  nodes: [
    { id: 'root', label: 'ROOT · 4 shots / 10 segments', kind: 'root', depth: 0, status: 'active', meta: 'ReCA Director', detail: 'Parallel shot graph with continuity anchors and final concat.' },
    { id: 'plan', label: 'Narrative & shot plan', kind: 'phase', depth: 1, status: 'done', meta: '4 shots', detail: 'Planner locked the oath arc, camera language, timing, and transitions.' },
    { id: 'assets', label: 'Character anchors', kind: 'phase', depth: 1, status: 'done', meta: '7 images', detail: 'Wukong identity sheet, mountain plate, sky palette, and prop anchors.' },
    { id: 'shot01', label: 'Shot 01 · Summit arrival', kind: 'shot', depth: 1, status: 'done', meta: '2 segments', detail: 'Establishing aerial into a controlled push toward the summit.' },
    { id: 's01a', label: '01A · cloud approach', kind: 'segment', depth: 2, status: 'done', meta: '8.0s', detail: 'Wide aerial. First-frame identity anchor passed validator.' },
    { id: 's01b', label: '01B · landing beat', kind: 'segment', depth: 2, status: 'done', meta: '6.4s', detail: 'Hero lands against the orange horizon. Motion score 0.91.' },
    { id: 'shot02', label: 'Shot 02 · Cliff gaze', kind: 'shot', depth: 1, status: 'active', meta: '3 / 4 segments', detail: 'The emotional hinge. Serial segments preserve face and staff continuity.' },
    { id: 's02a', label: '02A · shoulder turn', kind: 'segment', depth: 2, status: 'done', meta: '7.0s', detail: 'Medium profile, subtle wind and cloth movement.' },
    { id: 's02b', label: '02B · oath close-up', kind: 'segment', depth: 2, status: 'active', meta: '72%', detail: 'Rendering close-up with controlled eye-line and staff silhouette.' },
    { id: 's02c', label: '02C · mountain answer', kind: 'segment', depth: 2, status: 'pending', meta: 'queued', detail: 'Reverse landscape shot, scheduled after the current continuity tail.' },
    { id: 'shot03', label: 'Shot 03 · Monkeys gather', kind: 'shot', depth: 1, status: 'pending', meta: '2 segments', detail: 'Crowd reaction and kinetic camera sweep.' },
    { id: 'shot04', label: 'Shot 04 · Oath tableau', kind: 'shot', depth: 1, status: 'pending', meta: '2 segments', detail: 'Final crane-out and title-safe hold for concat.' },
  ],
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function StatusDot({ status }) {
  return h('span', { className: `reca-status-dot is-${status}`, 'aria-hidden': 'true' })
}

function StageRail({ stages }) {
  return h('div', { className: 'reca-stage-rail' }, stages.map((stage, index) =>
    h(Fragment, { key: stage.id },
      h('div', { className: `reca-stage is-${stage.status}` },
        h('span', { className: 'reca-stage-mark' }, stage.status === 'done' ? '✓' : index + 1),
        h('span', null, stage.label),
      ),
      index < stages.length - 1 && h('span', { className: `reca-stage-line is-${stage.status}` }),
    ),
  ))
}

function Tree({ nodes, selected, onSelect }) {
  return h('div', { className: 'reca-tree', role: 'tree', 'aria-label': 'ReCA execution tree' }, nodes.map(node =>
    h('button', {
      key: node.id,
      className: `reca-node is-${node.status}${selected === node.id ? ' is-selected' : ''}`,
      style: { '--depth': node.depth },
      onClick: () => onSelect(node.id),
      role: 'treeitem',
      'aria-selected': selected === node.id,
    },
    h('span', { className: 'reca-node-guide', 'aria-hidden': 'true' }),
    h(StatusDot, { status: node.status }),
    h('span', { className: 'reca-node-copy' },
      h('strong', null, node.label),
      h('small', null, node.kind.toUpperCase()),
    ),
    h('span', { className: 'reca-node-meta' }, node.meta),
    ),
  ))
}

function Inspector({ node }) {
  if (!node) return null
  const showPreview = node.kind === 'segment' || node.kind === 'shot'
  return h('section', { className: 'reca-inspector' },
    h('div', { className: 'reca-inspector-heading' },
      h('div', null,
        h('span', { className: 'reca-eyebrow' }, 'NODE INSPECTOR'),
        h('h3', null, node.label),
      ),
      h('span', { className: `reca-state-pill is-${node.status}` }, node.status),
    ),
    showPreview && h('div', { className: 'reca-video-thumb' },
      h('video', {
        poster: node.posterUrl || node.imageUrl || poster,
        src: node.videoUrl || undefined,
        controls: Boolean(node.videoUrl),
        muted: true,
        preload: 'metadata',
        'aria-label': 'Segment video thumbnail',
      }),
      h('span', { className: 'reca-play' }, '▶'),
      h('span', { className: 'reca-video-badge' }, node.videoUrl ? 'REAL ARTIFACT' : 'VIDEO PREVIEW'),
    ),
    h('p', null, node.detail),
    h('div', { className: 'reca-facts' },
      h('span', null, h('b', null, 'Kind'), ` ${node.kind}`),
      h('span', null, h('b', null, 'State'), ` ${node.status}`),
      node.score != null && h('span', null, h('b', null, 'Score'), ` ${node.score}`),
    ),
  )
}

function traceModeLabel(mode) {
  return ({
    demo: 'DEMO TRACE',
    connecting: 'SYNCING',
    live: 'LIVE GATEWAY',
    stale: 'STALE SNAPSHOT',
    error: 'GATEWAY ERROR',
  })[mode] || String(mode || 'TRACE').toUpperCase()
}

function RecaOverlay({ connection, useSessions, resolveSession }) {
  const binding = RecaTrace.useOverlayRunId(useSessions, resolveSession)
  const trace = RecaTrace.useTraceSnapshot({
    connection,
    runId: binding.runId,
    fallback: SAMPLE,
    intervalMs: 1600,
  })
  const snapshot = trace.snapshot || SAMPLE
  const [open, setOpen] = useState(true)
  const [selected, setSelected] = useState('s02b')
  const [width, setWidth] = useState(WIDTHS[1])
  const drag = useRef(null)
  const selectedNode = snapshot.nodes.find(node => node.id === selected) || snapshot.nodes[0]

  const cycleWidth = () => {
    const current = WIDTHS.findIndex(candidate => candidate >= width - 12)
    setWidth(WIDTHS[(current + 1) % WIDTHS.length])
  }

  const startResize = (event) => {
    event.preventDefault()
    drag.current = true
    const move = (moveEvent) => setWidth(clamp(window.innerWidth - moveEvent.clientX - 14, 360, 680))
    const end = () => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  return h(Fragment, null,
    h('button', {
      className: `reca-launcher${open ? ' is-open' : ''}`,
      onClick: () => setOpen(value => !value),
      title: open ? 'Hide ReCA trace' : 'Show ReCA trace',
      'aria-label': open ? 'Hide ReCA trace' : 'Show ReCA trace',
    },
    h('span', { className: 'reca-launcher-orbit' }),
    h('span', { className: 'reca-launcher-mark' }, 'R'),
    !open && h('span', { className: 'reca-launcher-copy' }, 'ReCA trace'),
    !open && h('span', { className: 'reca-launcher-badge' }, `${snapshot.progress}%`),
    ),
    open && h('aside', {
      className: 'reca-overlay-panel',
      style: { width },
      'aria-label': 'ReCA execution trace drawer',
    },
    h('button', { className: 'reca-resize-handle', onPointerDown: startResize, 'aria-label': 'Resize trace drawer' }),
    h('header', { className: 'reca-panel-header' },
      h('div', { className: 'reca-brand' },
        h('span', { className: 'reca-logo' }, 'R'),
        h('div', null,
          h('span', { className: 'reca-eyebrow' }, 'RECA DIRECTOR'),
          h('h2', null, 'Live execution trace'),
        ),
      ),
      h('div', { className: 'reca-header-actions' },
        h('button', { onClick: cycleWidth, title: 'Change drawer width', 'aria-label': 'Change drawer width' }, '↔'),
        h('button', { onClick: () => setOpen(false), title: 'Close drawer', 'aria-label': 'Close drawer' }, '×'),
      ),
    ),
    h('section', { className: 'reca-run-summary' },
      h('div', { className: 'reca-run-row' },
        h('div', null,
          h('span', { className: `reca-live is-${trace.mode}` }, h('i'), ` ${traceModeLabel(trace.mode)}`),
          h('strong', null, snapshot.title),
          h('small', null, binding.runId || snapshot.runId),
        ),
        h('b', { className: 'reca-progress-number' }, `${snapshot.progress}%`),
      ),
      h('div', { className: 'reca-progress-track' }, h('span', { style: { width: `${snapshot.progress}%` } })),
      h(StageRail, { stages: snapshot.stages }),
    ),
    h('div', { className: 'reca-panel-body' },
      h('div', { className: 'reca-tree-heading' },
        h('span', null, 'EXECUTION TREE'),
        h('span', null, `${snapshot.nodes.length} nodes`),
      ),
      h(Tree, { nodes: snapshot.nodes, selected, onSelect: setSelected }),
      h(Inspector, { node: selectedNode }),
    ),
    h('footer', { className: 'reca-panel-footer' },
      h('span', { title: trace.error || undefined },
        h('i'),
        trace.mode === 'demo'
          ? ' No run_id in this Harness session · demo data'
          : trace.mode === 'live'
            ? ' Gateway snapshot synced'
            : trace.error || traceModeLabel(trace.mode),
      ),
      h('button', { onClick: () => setSelected('root') }, 'View root'),
    ),
    ),
  )
}

exports.inject = ['slots', 'connection', 'sessions']
exports.apply = function apply(ctx) {
  const resolveSession = (sessionId) => ctx.sessions.binding(sessionId)?.session
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'reca-execution-drawer',
    order: 40,
    inject: () => ({ connection: ctx.connection, resolveSession }),
  }, RecaOverlay))
}
