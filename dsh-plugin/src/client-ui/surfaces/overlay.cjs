'use strict'

const OVERLAY_STYLE_ID = 'dsh-reca-toolkit-overlay'
const WIDTHS = [388, 480, 620]

const OVERLAY_CSS = String.raw`
:root{--reca-ov-ink:#f8faff;--reca-ov-muted:#b3bccb;--reca-ov-line:rgba(255,255,255,.105);--reca-ov-lime:#c5fb70;--reca-ov-cyan:#8bddff;--reca-ov-orange:#ffad70;--reca-ov-red:#ff8798}
.reca-ov-launcher,.reca-ov-panel,.reca-ov-panel *{box-sizing:border-box}
.reca-ov-launcher{pointer-events:auto;position:fixed;right:18px;bottom:20px;z-index:2147482001;height:44px;min-width:44px;padding:0 13px;display:flex;align-items:center;gap:9px;color:#f8fafc;background:#101319;border:1px solid rgba(255,255,255,.16);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.28);cursor:pointer;font:600 12px/1 Inter,ui-sans-serif,system-ui,sans-serif}
.reca-ov-launcher.is-open{right:28px;bottom:28px;z-index:2147482003;width:34px;height:34px;min-width:34px;padding:0;border-radius:10px;opacity:0}
.reca-ov-mark,.reca-ov-logo{position:relative;z-index:1;display:grid;place-items:center;width:23px;height:23px;border-radius:7px;color:#11180b;background:var(--reca-ov-lime);font-weight:900}
.reca-ov-orbit{position:absolute;left:7px;width:31px;height:31px;border:1px solid rgba(185,246,90,.22);border-radius:50%}
.reca-ov-launcher-badge{margin-left:3px;padding:4px 6px;color:#17200b;background:var(--reca-ov-lime);border-radius:6px;font-size:10px}
.reca-ov-panel{pointer-events:auto;position:fixed;z-index:2147482002;top:14px;right:14px;bottom:14px;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:visible;color:var(--reca-ov-ink);background:linear-gradient(160deg,rgba(19,23,31,.975),rgba(8,10,14,.985));border:1px solid rgba(255,255,255,.14);border-radius:17px;box-shadow:-22px 28px 80px rgba(0,0,0,.38),0 1px 0 rgba(255,255,255,.08) inset;backdrop-filter:blur(18px) saturate(1.25);font:12px/1.45 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:reca-ov-slide-in .24s cubic-bezier(.2,.8,.2,1)}
@keyframes reca-ov-slide-in{from{opacity:0;transform:translateX(18px) scale(.985)}to{opacity:1;transform:translateX(0) scale(1)}}
.reca-ov-resize{position:absolute;top:50%;left:-6px;width:12px;height:78px;transform:translateY(-50%);border:0;border-radius:99px;background:transparent;cursor:ew-resize}
.reca-ov-resize:after{content:"";position:absolute;left:4px;top:18px;width:3px;height:42px;background:rgba(255,255,255,.22);border-radius:99px}
.reca-ov-header{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 13px;border-bottom:1px solid var(--reca-ov-line)}
.reca-ov-brand,.reca-ov-run-row,.reca-ov-inspector-heading{display:flex;align-items:center;gap:11px}
.reca-ov-logo{width:31px;height:31px;border-radius:9px;box-shadow:0 0 24px rgba(185,246,90,.18)}
.reca-ov-eyebrow{display:block;margin-bottom:2px;color:#a6afbf;font-size:9px;font-weight:800;letter-spacing:.16em}
.reca-ov-header h2,.reca-ov-inspector h3{margin:0;color:#f8fafc;font-size:14px;font-weight:700;letter-spacing:-.01em}
.reca-ov-actions{display:flex;gap:5px}
.reca-ov-actions button,.reca-ov-footer button{display:grid;place-items:center;width:29px;height:29px;color:#b7c0cf;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:8px;cursor:pointer;font:inherit}
.reca-ov-actions button:hover,.reca-ov-footer button:hover{color:#fff;background:rgba(255,255,255,.1)}
.reca-ov-mode-banner{padding:8px 16px;color:#fde68a;background:rgba(245,158,11,.095);border-bottom:1px solid rgba(245,158,11,.18);font-size:9px;letter-spacing:.035em}
.reca-ov-mode-banner.is-error{color:#fecdd3;background:rgba(244,63,94,.09);border-color:rgba(244,63,94,.17)}
.reca-ov-summary{padding:13px 16px 14px;background:rgba(255,255,255,.018);border-bottom:1px solid var(--reca-ov-line)}
.reca-ov-run-row{justify-content:space-between;align-items:flex-end}.reca-ov-run-row>div{min-width:0}
.reca-ov-run-row strong,.reca-ov-run-row small{display:block;max-width:310px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reca-ov-run-row strong{margin-top:5px;font-size:13px}.reca-ov-run-row small{margin-top:1px;color:var(--reca-ov-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}
.reca-ov-live{display:inline-flex;align-items:center;gap:5px;color:var(--reca-ov-lime);font-size:9px;font-weight:800;letter-spacing:.14em}.reca-ov-live.is-idle,.reca-ov-live.is-connecting,.reca-ov-live.is-debug{color:#fbbf24}.reca-ov-live.is-error,.reca-ov-live.is-run-not-found{color:var(--reca-ov-red)}
.reca-ov-live i,.reca-ov-footer i{display:inline-block;width:6px;height:6px;background:currentColor;border-radius:50%;box-shadow:0 0 8px currentColor}
.reca-ov-progress-number{color:var(--reca-ov-lime);font:800 24px/.9 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.08em}
.reca-ov-progress-track{height:3px;margin-top:11px;overflow:hidden;background:rgba(255,255,255,.08);border-radius:99px}.reca-ov-progress-track span{display:block;height:100%;background:linear-gradient(90deg,var(--reca-ov-cyan),var(--reca-ov-lime));border-radius:inherit;box-shadow:0 0 12px rgba(185,246,90,.36);transition:width .5s ease}
.reca-ov-stages{display:flex;align-items:center;margin-top:12px}.reca-ov-stage{display:flex;flex-direction:column;align-items:center;gap:4px;color:#697284;font-size:8px;font-weight:700}.reca-ov-stage.is-done{color:#a9b2c2}.reca-ov-stage.is-active{color:var(--reca-ov-lime)}
.reca-ov-stage-mark{display:grid;place-items:center;width:17px;height:17px;background:#191d25;border:1px solid #333946;border-radius:50%;font-size:8px}.reca-ov-stage.is-done .reca-ov-stage-mark{color:#11180b;background:var(--reca-ov-lime);border-color:var(--reca-ov-lime)}.reca-ov-stage.is-active .reca-ov-stage-mark{background:rgba(185,246,90,.1);border-color:var(--reca-ov-lime);box-shadow:0 0 0 3px rgba(185,246,90,.07)}
.reca-ov-stage-line{flex:1;height:1px;margin:0 3px 13px;background:#303541}.reca-ov-stage-line.is-done{background:rgba(185,246,90,.68)}
.reca-ov-body{display:grid;grid-template-rows:auto minmax(90px,.85fr) minmax(120px,1.15fr);min-height:0;padding:11px 10px 10px;overflow:hidden;scrollbar-width:thin;scrollbar-color:#3d4552 transparent}.reca-ov-tree-heading{display:flex;justify-content:space-between;padding:0 7px 7px;color:#737d8e;font-size:9px;font-weight:800;letter-spacing:.12em}.reca-ov-tree-scroll{min-height:0;overflow:auto;scrollbar-width:thin}.reca-ov-tree{display:grid;gap:2px}
.reca-ov-node{position:relative;width:100%;height:39px;min-height:39px;max-height:39px;overflow:hidden;padding:5px 7px 5px calc(9px + var(--reca-ov-indent,0px));display:grid;grid-template-columns:10px minmax(0,1fr) minmax(0,82px);align-items:center;gap:7px;color:#cad1dc;text-align:left;background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer;font:inherit}.reca-ov-node:hover{background:rgba(255,255,255,.035)}.reca-ov-node.is-selected{color:#fff;background:linear-gradient(90deg,rgba(125,211,252,.09),rgba(185,246,90,.045));border-color:rgba(125,211,252,.18)}
.reca-ov-guide{position:absolute;top:-4px;bottom:-4px;left:calc(14px + var(--reca-ov-guide-indent,0px));display:none;width:10px;border-left:1px solid #343a46;border-bottom:1px solid #343a46;border-radius:0 0 0 5px}.reca-ov-node[data-depth="1"] .reca-ov-guide,.reca-ov-node[data-depth="2"] .reca-ov-guide,.reca-ov-node[data-depth="3"] .reca-ov-guide{display:block}
.reca-ov-dot{position:relative;z-index:1;display:block;width:8px;height:8px;background:#596171;border:2px solid #151820;border-radius:50%;box-shadow:0 0 0 1px #596171}.reca-ov-dot.is-done{background:var(--reca-ov-lime);box-shadow:0 0 0 1px var(--reca-ov-lime)}.reca-ov-dot.is-active{background:var(--reca-ov-orange);box-shadow:0 0 0 1px var(--reca-ov-orange),0 0 9px rgba(255,155,85,.45);animation:reca-ov-pulse 1.6s ease-in-out infinite}.reca-ov-dot.is-failed,.reca-ov-dot.is-cancelled,.reca-ov-dot.is-interrupted{background:var(--reca-ov-red);box-shadow:0 0 0 1px var(--reca-ov-red)}
@keyframes reca-ov-pulse{50%{opacity:.52}}
.reca-ov-node-copy{min-width:0}.reca-ov-node-copy strong,.reca-ov-node-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-ov-node-copy strong{font-size:10px;font-weight:650}.reca-ov-node-copy small{margin-top:1px;color:#606a7b;font-size:7px;font-weight:800;letter-spacing:.12em}.reca-ov-node-meta{display:block;min-width:0;overflow:hidden;color:#8b94a4;text-align:right;text-overflow:ellipsis;white-space:nowrap;font:9px ui-monospace,SFMono-Regular,Menlo,monospace}
.reca-ov-empty{padding:28px 18px;color:#8490a3;text-align:center;border:1px dashed rgba(255,255,255,.11);border-radius:11px}.reca-ov-empty strong{display:block;margin-bottom:5px;color:#d5dbe5}
.reca-ov-inspector{display:flex;min-height:0;margin:8px 3px 0;overflow:hidden;flex-direction:column;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.085);border-radius:12px}.reca-ov-inspector-heading{flex:none;justify-content:space-between;align-items:flex-start;padding:11px 12px 9px;border-bottom:1px solid rgba(255,255,255,.07)}.reca-ov-inspector-heading>div{min-width:0}.reca-ov-inspector h3{max-width:100%;overflow-wrap:anywhere;font-size:12px}.reca-ov-inspector-scroll{min-height:0;overflow:auto;padding:0 12px 12px;scrollbar-width:thin}.reca-ov-node-id{margin:7px 0 0;color:#687284;font:8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.reca-ov-pill{flex:none;padding:3px 6px;color:#8c96a8;background:rgba(255,255,255,.05);border-radius:5px;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.reca-ov-pill.is-done{color:var(--reca-ov-lime)}.reca-ov-pill.is-active{color:var(--reca-ov-orange)}.reca-ov-pill.is-failed,.reca-ov-pill.is-cancelled,.reca-ov-pill.is-interrupted{color:var(--reca-ov-red)}
.reca-ov-media{position:relative;display:grid;place-items:center;min-height:142px;max-height:260px;margin-top:10px;overflow:hidden;color:#687284;background:#080a0e;border-radius:9px}.reca-ov-media video,.reca-ov-media img{width:100%;height:100%;max-height:260px;display:block;object-fit:contain}.reca-ov-media-badge{position:absolute;right:7px;bottom:7px;padding:3px 5px;color:#eef2f7;background:rgba(0,0,0,.68);border-radius:4px;font-size:7px;letter-spacing:.09em}.reca-ov-no-media{font:8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-align:center}.reca-ov-section{margin-top:10px}.reca-ov-section>strong{display:block;margin-bottom:3px;color:#737d8e;font-size:8px;letter-spacing:.1em;text-transform:uppercase}.reca-ov-section p{margin:0;color:#aab3c1;font-size:10px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap}.reca-ov-records{display:grid;gap:5px}.reca-ov-record{padding:7px;border:1px solid rgba(255,255,255,.09);border-radius:6px;color:#9da7b7;font-size:9px;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap}.reca-ov-record b{color:#d1d7e1}.reca-ov-record.is-pass{border-color:rgba(185,246,90,.28)}.reca-ov-record.is-flagged{border-color:rgba(251,113,133,.35)}.reca-ov-facts{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.reca-ov-facts span{min-width:0;padding:4px 6px;color:#8791a2;background:rgba(0,0,0,.2);border-radius:5px;font-size:8px;overflow-wrap:anywhere}.reca-ov-facts b{color:#cbd3df}
.reca-ov-footer{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;color:#747e8f;border-top:1px solid var(--reca-ov-line);font-size:9px}.reca-ov-footer>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-ov-footer button{flex:none;width:auto;height:25px;margin-left:8px;padding:0 8px}
.reca-ov-node-copy strong{color:#edf1f7;font-weight:680}.reca-ov-node-copy small{color:#9aa5b7}.reca-ov-node-meta{color:#abb4c3}.reca-ov-node-id,.reca-ov-section>strong{color:#929daf}.reca-ov-section p{color:#c4ccd7}.reca-ov-record{color:#bac3d0}.reca-ov-facts span{color:#aab4c4}.reca-ov-facts b,.reca-ov-record b{color:#e0e5ed}.reca-ov-footer{color:#9da8ba}
@media(max-width:760px){.reca-ov-panel{top:7px;right:7px;bottom:7px;width:min(92vw,480px)!important}.reca-ov-resize{display:none}}
`

function ensureOverlayStyle() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin="${OVERLAY_STYLE_ID}"]`)) return
  const style = document.createElement('style')
  style.dataset.plugin = OVERLAY_STYLE_ID
  style.textContent = OVERLAY_CSS
  document.head.appendChild(style)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function emptyRealSnapshot(runId) {
  return {
    runId: runId || null,
    title: runId ? `ReCA run ${runId}` : 'No ReCA run bound',
    state: runId ? 'connecting' : 'idle',
    progress: 0,
    terminal: false,
    stages: [
      { id: 'plan', label: 'Plan', status: 'pending' },
      { id: 'assets', label: 'Assets', status: 'pending' },
      { id: 'render', label: 'Render', status: 'pending' },
      { id: 'validate', label: 'Validate', status: 'pending' },
      { id: 'concat', label: 'Concat', status: 'pending' },
    ],
    nodes: [],
    recentEvents: [],
    film: { src: null, poster: null },
  }
}

function traceModeLabel(mode, runId) {
  if (!runId || mode === 'idle') return 'NO RUN BOUND'
  return ({
    connecting: 'SYNCING',
    live: 'LIVE GATEWAY',
    stale: 'STALE SNAPSHOT',
    error: 'GATEWAY ERROR',
    'run-not-found': 'RUN NOT FOUND · POLLING STOPPED',
    debug: 'DEBUG OVERRIDE',
  })[mode] || String(mode || 'TRACE').toUpperCase()
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function createOverlayComponent(runtime) {
  const { React, RecaTrace } = runtime || {}
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('registerOverlay requires runtime.React')
  }
  if (!RecaTrace || (!RecaTrace.useOverlayRunBinding && !RecaTrace.useOverlayRunId) || typeof RecaTrace.useTraceSnapshot !== 'function') {
    throw new Error('registerOverlay requires the shared runtime.RecaTrace')
  }

  const { Fragment, useEffect, useRef, useState } = React
  const h = React.createElement

  function StatusDot({ status }) {
    return h('span', { className: `reca-ov-dot is-${status || 'pending'}`, 'aria-hidden': 'true' })
  }

  function StageRail({ stages }) {
    return h('div', { className: 'reca-ov-stages' }, (stages || []).map((stage, index) =>
      h(Fragment, { key: stage.id },
        h('div', { className: `reca-ov-stage is-${stage.status}` },
          h('span', { className: 'reca-ov-stage-mark' }, stage.status === 'done' ? '\u2713' : index + 1),
          h('span', null, stage.label),
        ),
        index < stages.length - 1 && h('span', { className: `reca-ov-stage-line is-${stage.status}` }),
      ),
    ))
  }

  function Tree({ nodes, selected, onSelect, runId }) {
    if (!nodes.length) {
      return h('div', { className: 'reca-ov-empty' },
        h('strong', null, 'Waiting for the first trace snapshot'),
        runId ? 'The drawer is bound to this run_id; waiting for real nodes.' : 'Start ReCA in the selected session to bind a run.',
      )
    }
    return h('div', { className: 'reca-ov-tree', role: 'tree', 'aria-label': 'ReCA execution tree' }, nodes.map((node) => {
      const depth = Math.max(0, Math.min(3, Number(node.depth) || 0))
      return h('button', {
        key: node.id,
        className: `reca-ov-node is-${node.status}${selected === node.id ? ' is-selected' : ''}`,
        style: { '--reca-ov-indent': `${depth * 20}px`, '--reca-ov-guide-indent': `${Math.max(0, depth - 1) * 20}px` },
        'data-depth': depth,
        'data-reca-node-id': node.id,
        onClick: () => onSelect(node.id),
        title: `${node.label || node.id}${node.meta ? ` · ${node.meta}` : ''}`,
        role: 'treeitem',
        'aria-selected': selected === node.id,
      },
      h('span', { className: 'reca-ov-guide', 'aria-hidden': 'true' }),
      h(StatusDot, { status: node.status }),
      h('span', { className: 'reca-ov-node-copy' },
        h('strong', null, node.label || node.id),
        h('small', null, String(node.kind || 'node').toUpperCase()),
      ),
      h('span', { className: 'reca-ov-node-meta' }, node.meta || ''),
      )
    }))
  }

  function Media({ node }) {
    const videoUrl = node.videoUrl || null
    const imageUrl = node.imageUrl || node.posterUrl || null
    return h('div', { className: 'reca-ov-media' },
      videoUrl
        ? h('video', { src: videoUrl, poster: node.posterUrl || undefined, controls: true, muted: true, preload: 'metadata', 'aria-label': `${node.label} artifact` })
        : imageUrl
          ? h('img', { src: imageUrl, alt: `${node.label} artifact` })
          : h('span', { className: 'reca-ov-no-media' }, 'NO MEDIA PUBLISHED FOR THIS NODE'),
      videoUrl || imageUrl ? h('span', { className: 'reca-ov-media-badge' }, videoUrl ? 'VIDEO ARTIFACT' : 'IMAGE ARTIFACT') : null,
    )
  }

  function TextSection({ label, value }) {
    if (!hasText(value)) return null
    return h('section', { className: 'reca-ov-section' }, h('strong', null, label), h('p', null, value))
  }

  function ValidationRecords({ records }) {
    if (!Array.isArray(records) || records.length === 0) return null
    return h('section', { className: 'reca-ov-section' }, h('strong', null, 'Validation history'),
      h('div', { className: 'reca-ov-records' }, ...records.map((record, index) =>
        h('div', { className: `reca-ov-record ${record.passed ? 'is-pass' : 'is-flagged'}`, key: `${record.timestamp || index}-${index}` },
          h('b', null, `Attempt ${record.attempt ?? index + 1} · ${record.passed ? 'passed' : 'flagged'}${record.score != null ? ` · score ${record.score}` : ''}`),
          hasText(record.detail) ? `\n${record.detail}` : '',
        ),
      )),
    )
  }

  function RepairRecords({ records }) {
    if (!Array.isArray(records) || records.length === 0) return null
    return h('section', { className: 'reca-ov-section' }, h('strong', null, 'Repair history'),
      h('div', { className: 'reca-ov-records' }, ...records.map((record, index) =>
        h('div', { className: 'reca-ov-record', key: `${record.timestamp || index}-${index}` },
          h('b', null, `Attempt ${record.attempt ?? index + 1} · ${record.strategy || 'repair'}`),
          hasText(record.detail) ? `\n${record.detail}` : '',
        ),
      )),
    )
  }

  function Inspector({ node }) {
    if (!node) return null
    return h('section', { className: 'reca-ov-inspector' },
      h('div', { className: 'reca-ov-inspector-heading' },
        h('div', null,
          h('span', { className: 'reca-ov-eyebrow' }, 'NODE INSPECTOR'),
          h('h3', null, node.label || node.id),
          h('div', { className: 'reca-ov-node-id' }, node.id),
        ),
        h('span', { className: `reca-ov-pill is-${node.status}` }, node.status),
      ),
      h('div', { className: 'reca-ov-inspector-scroll' },
        h(Media, { node }),
        h(TextSection, { label: 'Detail', value: node.detail }),
        h(TextSection, { label: 'Story', value: node.story }),
        h(TextSection, { label: 'Prompt', value: node.prompt }),
        h(TextSection, { label: 'Story goal', value: node.storyGoal }),
        h(TextSection, { label: 'Visual intent', value: node.visualIntent }),
        h(TextSection, { label: 'Start state', value: node.startState }),
        h(TextSection, { label: 'End state', value: node.endState }),
        h(ValidationRecords, { records: node.validations }),
        h(RepairRecords, { records: node.repairs }),
        h('div', { className: 'reca-ov-facts' },
          h('span', null, h('b', null, 'Kind'), ` ${node.kind || 'node'}`),
          h('span', null, h('b', null, 'State'), ` ${node.status || 'unknown'}`),
          node.durationS != null ? h('span', null, h('b', null, 'Duration'), ` ${node.durationS}s`) : null,
          node.requestType ? h('span', null, h('b', null, 'Request'), ` ${node.requestType}`) : null,
          node.score != null ? h('span', null, h('b', null, 'Score'), ` ${node.score}`) : null,
          node.strategy ? h('span', null, h('b', null, 'Strategy'), ` ${node.strategy}`) : null,
        ),
      ),
    )
  }

  function ConnectedOverlay({ connection, resolveSession, useSessions }) {
    const binding = typeof RecaTrace.useOverlayRunBinding === 'function'
      ? RecaTrace.useOverlayRunBinding(useSessions, resolveSession)
      : RecaTrace.useOverlayRunId(useSessions, resolveSession)
    const [open, setOpen] = useState(false)
    const runId = binding?.runId || null
    const trace = RecaTrace.useTraceSnapshot({
      connection,
      binding,
      runId,
      fallback: null,
      intervalMs: 1600,
      active: open,
      visible: open,
    })
    const snapshot = trace.snapshot || emptyRealSnapshot(runId)
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : []
    const stages = Array.isArray(snapshot.stages) ? snapshot.stages : []
    const [selected, setSelected] = useState(null)
    const [width, setWidth] = useState(WIDTHS[1])
    const drag = useRef(null)

    useEffect(() => { setSelected(nodes[0]?.id || null) }, [snapshot.runId, runId])
    useEffect(() => {
      if (!selected || !nodes.some((node) => node.id === selected)) setSelected(nodes[0]?.id || null)
    }, [nodes, selected])

    const selectedNode = nodes.find((node) => node.id === selected) || nodes[0] || null
    const progress = clamp(Number(snapshot.progress) || 0, 0, 100)
    const mode = runId ? (trace.mode || 'connecting') : 'idle'

    const cycleWidth = () => {
      const current = WIDTHS.findIndex((candidate) => candidate >= width - 12)
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

    const footerText = !runId
      ? 'Waiting for a ReCA tool result in the selected session'
      : trace.mode === 'run-not-found'
        ? 'Run not found on this Gateway · polling stopped'
      : trace.mode === 'live'
        ? `Gateway snapshot synced · session ${binding.sessionId || 'unknown'}`
        : trace.error || traceModeLabel(trace.mode, runId)

    return h(Fragment, null,
      h('button', {
        className: `reca-ov-launcher${open ? ' is-open' : ''}`,
        onClick: () => setOpen((value) => !value),
        title: open ? 'Hide ReCA trace' : 'Show ReCA trace',
        'aria-label': open ? 'Hide ReCA trace' : 'Show ReCA trace',
      },
      h('span', { className: 'reca-ov-orbit' }),
      h('span', { className: 'reca-ov-mark' }, 'R'),
      !open && h('span', null, 'ReCA trace'),
      !open && h('span', { className: 'reca-ov-launcher-badge' }, runId ? `${progress}%` : '—'),
      ),
      open && h('aside', {
        className: 'reca-ov-panel',
        style: { width },
        'aria-label': 'ReCA execution trace drawer',
        'data-reca-run-id': runId || '',
        'data-reca-trace-mode': mode,
      },
      h('button', { className: 'reca-ov-resize', onPointerDown: startResize, 'aria-label': 'Resize trace drawer' }),
      h('header', { className: 'reca-ov-header' },
        h('div', { className: 'reca-ov-brand' },
          h('span', { className: 'reca-ov-logo' }, 'R'),
          h('div', null,
            h('span', { className: 'reca-ov-eyebrow' }, 'RECA DIRECTOR'),
            h('h2', null, 'Live execution trace'),
          ),
        ),
        h('div', { className: 'reca-ov-actions' },
          h('button', { onClick: cycleWidth, title: 'Change drawer width', 'aria-label': 'Change drawer width' }, '\u2194'),
          h('button', { onClick: () => setOpen(false), title: 'Close drawer', 'aria-label': 'Close drawer' }, '\u00d7'),
        ),
      ),
      (!runId || mode === 'run-not-found' || (!trace.snapshot && trace.mode === 'error')) && h('div', {
        className: `reca-ov-mode-banner${runId ? ' is-error' : ''}`,
        role: trace.mode === 'error' || mode === 'run-not-found' ? 'alert' : 'status',
      }, !runId
        ? 'The selected Harness session has no ReCA run_id. Start ReCA to populate this view.'
        : mode === 'run-not-found'
          ? `Run ${runId} was not found on the selected Gateway. Polling has stopped.`
          : `Bound to ${runId}, but its Gateway snapshot is unavailable.`),
      h('section', { className: 'reca-ov-summary' },
        h('div', { className: 'reca-ov-run-row' },
          h('div', null,
            h('span', { className: `reca-ov-live is-${mode}` }, h('i'), ` ${traceModeLabel(mode, runId)}`),
            h('strong', null, snapshot.title),
            h('small', null, runId || 'no session-bound run_id'),
          ),
          h('b', { className: 'reca-ov-progress-number' }, `${progress}%`),
        ),
        h('div', { className: 'reca-ov-progress-track' }, h('span', { style: { width: `${progress}%` } })),
        h(StageRail, { stages }),
      ),
      h('div', { className: 'reca-ov-body' },
        h('div', { className: 'reca-ov-tree-heading' },
          h('span', null, 'EXECUTION TREE'),
          h('span', null, `${nodes.length} nodes`),
        ),
        h('div', { className: 'reca-ov-tree-scroll' }, h(Tree, { nodes, selected, onSelect: setSelected, runId })),
        h(Inspector, { node: selectedNode }),
      ),
      h('footer', { className: 'reca-ov-footer' },
        h('span', { title: trace.error || undefined }, h('i'), ` ${footerText}`),
        h('button', { onClick: () => setSelected(nodes[0]?.id || null), disabled: nodes.length === 0 }, 'View root'),
      ),
      ),
    )
  }

  function RecaOverlay(props) {
    if (typeof props.useSessions !== 'function') {
      return h('div', { className: 'reca-ov-mode-banner is-error', role: 'alert' }, 'ReCA overlay requires the Harness useSessions standard prop.')
    }
    return h(ConnectedOverlay, props)
  }

  return RecaOverlay
}

function registerOverlay(ctx, runtime) {
  if (!ctx?.slots || typeof ctx.slots.inject !== 'function' || typeof ctx.slots.register !== 'function') {
    throw new Error('registerOverlay requires ctx.slots')
  }
  if (!ctx.connection?.rpc) throw new Error('registerOverlay requires ctx.connection.rpc')
  if (!ctx.sessions || typeof ctx.sessions.binding !== 'function') {
    throw new Error('registerOverlay requires ctx.sessions.binding')
  }

  ensureOverlayStyle()
  const RecaOverlay = createOverlayComponent(runtime)
  const resolveSession = (sessionId) => ctx.sessions.binding(sessionId)?.session

  return ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'reca-execution-drawer',
    order: 40,
    label: 'ReCA execution trace',
    inject: () => ({ connection: ctx.connection, resolveSession }),
  }, RecaOverlay))
}

module.exports = {
  OVERLAY_CSS,
  OVERLAY_STYLE_ID,
  registerOverlay,
}
