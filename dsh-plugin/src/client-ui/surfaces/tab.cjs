'use strict'

const TAB_STYLE_ID = 'dsh-reca-toolkit/reca-tab'
const TAB_TREE_MIN_WIDTH = 780
const TAB_TREE_HORIZONTAL_PADDING = 44
const TAB_TREE_SHOT_MIN_WIDTH = 175
const TAB_TREE_SHOT_GAP = 12

const TAB_CSS = String.raw`
.reca-tab-surface{--bg:#000;--panel:#101611;--panel2:#141c16;--line:rgba(214,244,202,.13);--line2:rgba(214,244,202,.26);--text:#f4f8f5;--muted:#a5b2a8;--lime:#b9ff66;--green:#72e5a0;--cyan:#83e4f0;--amber:#ffc070;--violet:#b8a4ff;--rose:#ff8290;position:relative;min-width:0;min-height:100%;overflow:auto;color:var(--text);background:#000;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.reca-tab-surface *{box-sizing:border-box}.reca-tab-surface button{font:inherit}.reca-tab-top{position:sticky;z-index:10;top:0;display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:18px;align-items:center;min-height:70px;padding:12px 22px;border-bottom:1px solid var(--line);background:rgba(9,13,10,.92);backdrop-filter:blur(18px)}
.reca-tab-eyebrow{display:flex;align-items:center;gap:8px;margin-bottom:5px;color:var(--lime);font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em;text-transform:uppercase}.reca-tab-dot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 12%,transparent),0 0 18px color-mix(in srgb,currentColor 55%,transparent)}
.reca-tab-eyebrow.is-idle,.reca-tab-eyebrow.is-connecting,.reca-tab-eyebrow.is-stale,.reca-tab-eyebrow.is-debug{color:var(--amber)}.reca-tab-eyebrow.is-error,.reca-tab-eyebrow.is-run-not-found{color:var(--rose)}.reca-tab-title{display:flex;min-width:0;align-items:baseline;gap:10px}.reca-tab-title strong,.reca-tab-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-tab-title strong{font-size:14px;font-weight:650}.reca-tab-title span{color:var(--muted);font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.reca-tab-controls{display:flex;align-items:center;gap:9px}.reca-tab-mode{padding:6px 9px;border:1px solid rgba(98,219,145,.3);border-radius:999px;color:var(--green);background:rgba(98,219,145,.06);font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.reca-tab-mode.is-idle,.reca-tab-mode.is-connecting,.reca-tab-mode.is-stale,.reca-tab-mode.is-debug{border-color:rgba(255,180,95,.32);color:var(--amber);background:rgba(255,180,95,.06)}.reca-tab-mode.is-error,.reca-tab-mode.is-run-not-found{border-color:rgba(255,111,127,.34);color:var(--rose)}.reca-tab-poll{color:#657169;font:8px ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-error{padding:8px 22px;border-bottom:1px solid rgba(255,111,127,.23);color:#de929c;background:rgba(255,111,127,.05);font:8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.reca-tab-stages{display:grid;grid-template-columns:repeat(5,minmax(76px,1fr));gap:8px;padding:13px 22px;border-bottom:1px solid var(--line)}.reca-tab-stage{display:flex;align-items:center;justify-content:center;min-height:30px;gap:7px;border:1px solid var(--line);border-radius:999px;color:#657168;background:rgba(255,255,255,.012);font-size:9px;letter-spacing:.06em;text-transform:uppercase}.reca-tab-stage:before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}.reca-tab-stage.active{border-color:rgba(255,180,95,.42);color:var(--amber);background:rgba(255,180,95,.06)}.reca-tab-stage.done{border-color:rgba(98,219,145,.25);color:var(--green)}.reca-tab-stage.failed,.reca-tab-stage.cancelled,.reca-tab-stage.interrupted{border-color:rgba(255,111,127,.36);color:var(--rose)}
.reca-tab-meta{display:grid;grid-template-columns:1.2fr repeat(4,1fr);border-bottom:1px solid var(--line);background:rgba(255,255,255,.01)}.reca-tab-meta>div{min-width:0;padding:13px 18px;border-right:1px solid var(--line)}.reca-tab-meta>div:last-child{border-right:0}.reca-tab-meta small{display:block;margin-bottom:5px;color:#5e6a61;font:8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}.reca-tab-meta strong{display:block;overflow:hidden;color:#cbd5cd;font-size:10px;font-weight:540;text-overflow:ellipsis;white-space:nowrap}
.reca-tab-assets{padding:17px 22px 19px;border-bottom:1px solid var(--line);background:#000}.reca-tab-section-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;font:8px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-section-label span{display:inline-flex;height:21px;align-items:center;padding:0 9px;border-radius:5px;color:#04100e;background:linear-gradient(135deg,#249c91,#66d1b2);font-weight:800;letter-spacing:.11em}.reca-tab-section-label em{min-width:0;overflow:hidden;color:#59615c;font-style:normal;letter-spacing:0;text-overflow:ellipsis;white-space:nowrap}.reca-tab-asset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.reca-tab-asset{position:relative;width:100%;height:60px;min-height:60px;max-height:60px;overflow:hidden;padding:10px 10px 9px 51px;border:1px solid var(--line);border-radius:10px;color:#aeb9b0;text-align:left;background:#0d120e;opacity:.45;cursor:pointer}.reca-tab-asset:before{content:"";position:absolute;left:8px;top:8px;width:35px;height:42px;border:1px solid var(--line);border-radius:7px;background:var(--asset-image,#151b16) center/cover}.reca-tab-asset.done{border-color:color-mix(in srgb,var(--asset-color,#73d9e7) 42%,transparent);opacity:1}.reca-tab-asset.active{border-color:rgba(170,145,255,.48);opacity:.86}.reca-tab-asset.selected,.reca-tab-asset:hover{outline:1px solid rgba(115,217,231,.5);opacity:1}.reca-tab-asset strong,.reca-tab-asset small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-tab-asset strong{font-size:9.5px;font-weight:560}.reca-tab-asset small{color:#667269;font:7.5px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}
.reca-tab-workspace{display:grid;grid-template-columns:minmax(620px,1.65fr) minmax(260px,.65fr);min-height:560px}.reca-tab-graph-wrap{min-width:0;overflow:auto;border-right:1px solid var(--line);background:#000}.reca-tab-graph{position:relative;min-width:var(--reca-tab-tree-min-width,780px);padding:27px 22px 48px;background:#000}.reca-tab-tree-head{position:relative;display:grid;grid-template-columns:minmax(0,1fr)}.reca-tab-tree-head:after{content:"";position:absolute;z-index:0;top:70px;bottom:0;left:50%;width:1px;background:rgba(185,255,102,.42);pointer-events:none}.reca-tab-tree-head:not(.has-root):after{top:0}.reca-tab-root{position:relative;z-index:2;display:block;width:min(350px,70%);height:70px;min-height:70px;max-height:70px;margin:0 auto 12px;overflow:hidden;padding:10px 16px;border:1px solid rgba(170,145,255,.38);border-radius:13px;color:inherit;background:linear-gradient(150deg,rgba(170,145,255,.08),rgba(16,22,18,.96));box-shadow:0 0 30px rgba(170,145,255,.08);text-align:center;cursor:pointer}.reca-tab-root.done{border-color:rgba(185,255,102,.5)}.reca-tab-root.selected,.reca-tab-root:hover{outline:1px solid rgba(115,217,231,.52)}.reca-tab-root small,.reca-tab-root strong,.reca-tab-root span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-tab-root small{color:var(--violet);font:8.5px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em}.reca-tab-root strong{margin:6px 0 3px;font-size:13.5px}.reca-tab-root span{color:#748178;font-size:9.5px}.reca-tab-phase-row{position:relative;z-index:1;display:flex;width:auto;justify-content:center;gap:6px;margin:0 auto 18px}.reca-tab-surface .reca-tab-phase{position:relative;z-index:1;width:78px;height:22px;min-height:22px;max-height:22px;overflow:hidden;padding:0 8px;border:0;border-radius:5px;color:#fff;background:linear-gradient(135deg,#555d58,#7f8983);box-shadow:none;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font:800 8.5px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em}.reca-tab-phase.tone-plan{background:linear-gradient(135deg,#6652c7,#a78bea)}.reca-tab-phase.tone-visual{color:#04100e;background:linear-gradient(135deg,#249c91,#66d1b2)}.reca-tab-phase.pending{opacity:.5;filter:saturate(.7)}.reca-tab-phase.done{opacity:1}.reca-tab-phase.active,.reca-tab-phase.running{opacity:1}.reca-tab-phase.failed,.reca-tab-phase.flagged,.reca-tab-phase.cancelled,.reca-tab-phase.interrupted{color:#fff;background:linear-gradient(135deg,#b83f54,#ef6b7c);opacity:1}.reca-tab-phase.selected,.reca-tab-phase:hover{outline:1px solid #f3f6f4;outline-offset:2px;filter:brightness(1.08)}
.reca-tab-shot-grid{display:grid;grid-template-columns:repeat(var(--shot-count,4),minmax(175px,1fr));gap:var(--reca-tab-shot-gap,12px)}.reca-tab-shot{position:relative;padding-top:17px}.reca-tab-shot:before{content:"";position:absolute;top:0;left:50%;width:1px;height:17px;background:rgba(185,255,102,.42);pointer-events:none}.reca-tab-shot:not(:last-child):after{content:"";position:absolute;top:0;left:50%;width:calc(100% + var(--reca-tab-shot-gap,12px));height:1px;background:rgba(185,255,102,.42);pointer-events:none}.reca-tab-shot-head-wrap{position:relative}.reca-tab-shot-head{position:relative;display:block;width:100%;height:70px;min-height:70px;max-height:70px;overflow:hidden;padding:9px 10px;border:1px solid rgba(98,219,145,.24);border-radius:10px;color:inherit;text-align:left;background:#0e1410;cursor:pointer}.reca-tab-shot-head.has-anchor{padding-right:55px}.reca-tab-shot-head.is-active{border-color:rgba(170,145,255,.42)}.reca-tab-shot-head.is-pending{opacity:.52}.reca-tab-shot-head.is-failed{border-color:rgba(255,111,127,.42)}.reca-tab-shot-head.selected,.reca-tab-shot-head:hover{outline:1px solid rgba(115,217,231,.48)}.reca-tab-shot-head small,.reca-tab-shot-head strong,.reca-tab-shot-head span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-tab-shot-head small{color:#587061;font:7.5px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.reca-tab-shot-head strong{margin:5px 0 3px;font-size:10.5px}.reca-tab-shot-head span{color:#6c796f;font-size:8.5px}.reca-tab-anchor{position:absolute;right:7px;top:7px;width:41px;height:55px;overflow:hidden;border:1px solid var(--line);border-radius:7px;background:#111713 center/cover;cursor:pointer}.reca-tab-anchor.selected,.reca-tab-anchor:hover{outline:1px solid var(--cyan)}.reca-tab-chain{position:relative;display:grid;gap:10px;margin-top:15px}.reca-tab-chain:before{content:"";position:absolute;z-index:0;top:-15px;bottom:22px;left:50%;width:1px;background:rgba(255,180,95,.46)}
.reca-tab-node-wrap{position:relative;z-index:1}.reca-tab-leaf{position:relative;z-index:1;display:grid;width:100%;height:51px;min-height:51px;max-height:51px;overflow:hidden;grid-template-columns:25px minmax(0,1fr) minmax(0,54px);gap:7px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:9px;color:#b9c3bb;background:#101511;cursor:pointer;transition:.2s ease}.reca-tab-leaf:hover,.reca-tab-leaf.selected{border-color:rgba(115,217,231,.5);transform:translateY(-1px)}.reca-tab-leaf.pending{opacity:.42}.reca-tab-leaf.active,.reca-tab-leaf.running{border-color:var(--violet);background:rgba(170,145,255,.06);box-shadow:0 0 22px rgba(170,145,255,.12)}.reca-tab-leaf.failed,.reca-tab-leaf.flagged{border-color:#cf5d68;background:#18090c}.reca-tab-leaf.done{border-color:rgba(115,217,231,.36);background:rgba(115,217,231,.035)}.reca-tab-leaf.repaired{border-color:rgba(255,180,95,.52)}.reca-tab-leaf-index{display:grid;place-items:center;width:25px;height:25px;border:1px solid var(--line);border-radius:6px;color:#69756c;font:8.5px ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-leaf-copy{min-width:0;text-align:left}.reca-tab-leaf-copy strong,.reca-tab-leaf-copy small,.reca-tab-node-state{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reca-tab-leaf-copy strong{font-size:9.5px;font-weight:570}.reca-tab-leaf-copy small,.reca-tab-node-state{color:#657169;font:7.5px ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-leaf.failed .reca-tab-node-state,.reca-tab-leaf.flagged .reca-tab-node-state{color:#ff8d97}.reca-tab-node-state{text-align:right;text-transform:uppercase}.reca-tab-repairs{position:relative;display:flex;flex-wrap:wrap;gap:4px;margin:5px 6px 0 29px}.reca-tab-repairs:before{content:"";position:absolute;left:-10px;top:-7px;width:9px;height:15px;border-left:1px solid rgba(218,148,61,.66);border-bottom:1px solid rgba(218,148,61,.66)}.reca-tab-surface .reca-tab-repair{display:block;width:auto;max-width:100%;height:19px;min-height:19px;max-height:19px;overflow:hidden;padding:0 7px;border:0;border-radius:5px;color:#160d03;text-align:left;text-overflow:ellipsis;white-space:nowrap;background:linear-gradient(135deg,#ce812a,#efb35a);box-shadow:none;cursor:pointer;font:800 8px/19px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.07em}.reca-tab-repair.is-failed,.reca-tab-repair.is-flagged{color:#fff;background:linear-gradient(135deg,#b83f54,#ef6b7c)}.reca-tab-repair.selected,.reca-tab-repair:hover{outline:1px solid #f3f6f4;outline-offset:2px;filter:brightness(1.08)}
@keyframes reca-tab-node-pulse{0%,100%{opacity:.58}50%{opacity:1}}
.reca-tab-root.is-active,.reca-tab-root.is-running,.reca-tab-asset.active,.reca-tab-asset.running,.reca-tab-phase.active,.reca-tab-phase.running,.reca-tab-shot-head.is-active,.reca-tab-shot-head.is-running,.reca-tab-leaf.active,.reca-tab-leaf.running,.reca-tab-repair.is-active,.reca-tab-repair.is-running{animation:reca-tab-node-pulse 1.3s ease-in-out infinite}
.reca-tab-root.is-done,.reca-tab-asset.done,.reca-tab-phase.done,.reca-tab-shot-head.is-done,.reca-tab-leaf.done,.reca-tab-leaf.repaired,.reca-tab-repair.is-done{filter:saturate(.58) brightness(.88);opacity:.82}
.reca-tab-root.is-done:hover,.reca-tab-root.is-done.selected,.reca-tab-asset.done:hover,.reca-tab-asset.done.selected,.reca-tab-phase.done:hover,.reca-tab-phase.done.selected,.reca-tab-shot-head.is-done:hover,.reca-tab-shot-head.is-done.selected,.reca-tab-leaf.done:hover,.reca-tab-leaf.done.selected,.reca-tab-leaf.repaired:hover,.reca-tab-leaf.repaired.selected,.reca-tab-repair.is-done:hover,.reca-tab-repair.is-done.selected{filter:saturate(.8) brightness(1);opacity:1}
@media(prefers-reduced-motion:reduce){.reca-tab-root,.reca-tab-asset,.reca-tab-phase,.reca-tab-shot-head,.reca-tab-leaf,.reca-tab-repair{animation:none!important}}
.reca-tab-inspector{min-width:0;display:flex;max-height:calc(100vh - 24px);flex-direction:column;overflow:hidden;background:rgba(7,10,8,.65)}.reca-tab-inspector-head{flex:none;padding:20px 20px 15px;border-bottom:1px solid var(--line)}.reca-tab-inspector-kicker{color:var(--cyan);font:8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}.reca-tab-inspector h2{margin:8px 0 5px;overflow-wrap:anywhere;font-size:16px;letter-spacing:-.02em}.reca-tab-inspector-id{overflow-wrap:anywhere;color:#606d63;font:8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-inspector-body{min-height:0;flex:1;overflow:auto;padding:17px 20px;scrollbar-width:thin}.reca-tab-inspector-section{margin-top:13px}.reca-tab-inspector-section:first-child{margin-top:0}.reca-tab-inspector-section>strong{display:block;margin-bottom:4px;color:#68756c;font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase}.reca-tab-inspector-section p{margin:0;color:#929e95;font-size:10px;line-height:1.7;overflow-wrap:anywhere;white-space:pre-wrap}.reca-tab-facts{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0}.reca-tab-facts span{min-width:0;padding:5px 7px;border:1px solid var(--line);border-radius:6px;color:#a6b1a8;font:7px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.reca-tab-preview{display:grid;min-height:160px;place-items:center;border:1px solid var(--line);border-radius:11px;color:#5c685f;background:#0b100c;font:8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-align:center}.reca-tab-media{display:block;width:100%;min-height:160px;max-height:300px;border:1px solid var(--line);border-radius:11px;background:#050706;object-fit:contain}.reca-tab-records{display:grid;gap:6px}.reca-tab-record{padding:8px;border:1px solid var(--line);border-radius:7px;color:#8d998f;font-size:8px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap}.reca-tab-record b{color:#bec8c0}.reca-tab-record.is-pass{border-color:rgba(98,219,145,.3)}.reca-tab-record.is-flagged{border-color:rgba(255,111,127,.38)}.reca-tab-empty{padding:16px;border:1px dashed var(--line);border-radius:10px;color:#667169;font:9px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.reca-tab-final{display:grid;grid-template-columns:minmax(260px,.7fr) minmax(380px,1.3fr);max-height:320px;margin:0 22px 28px;overflow:hidden;border:1px solid rgba(185,255,102,.22);border-radius:14px;background:#0d120e}.reca-tab-final-copy{display:block;width:100%;min-width:0;max-height:320px;overflow:hidden;padding:26px;border:0;color:inherit;text-align:left;background:transparent;cursor:pointer}.reca-tab-final-copy.selected,.reca-tab-final-copy:hover{outline:1px solid rgba(115,217,231,.45);outline-offset:-1px}.reca-tab-final-copy small,.reca-tab-final-copy h2,.reca-tab-final-copy p{display:block;overflow:hidden;text-overflow:ellipsis}.reca-tab-final-copy small{color:var(--lime);font:8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;white-space:nowrap}.reca-tab-final-copy h2{margin:10px 0 8px;font-size:22px;letter-spacing:-.035em;white-space:nowrap}.reca-tab-final-copy p{margin:0;color:#78857b;font-size:10px;line-height:1.65;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}.reca-tab-final video{width:100%;height:100%;min-height:235px;max-height:320px;object-fit:contain;background:#050706}.reca-tab-final-placeholder{display:grid;min-height:235px;place-items:center;color:#566158;background:#090c0a;font:9px ui-monospace,SFMono-Regular,Menlo,monospace}.reca-tab-final.waiting{opacity:.72}
.reca-tab-poll,.reca-tab-stage,.reca-tab-root span,.reca-tab-shot-head small,.reca-tab-shot-head span,.reca-tab-leaf-index,.reca-tab-leaf-copy small,.reca-tab-node-state{color:#9ca9a0}
.reca-tab-leaf{color:#e3eae5}.reca-tab-leaf-copy strong{font-weight:600}.reca-tab-phase.pending,.reca-tab-leaf.pending,.reca-tab-shot-head.is-pending{opacity:.68}
.reca-tab-root.is-done,.reca-tab-asset.done,.reca-tab-phase.done,.reca-tab-shot-head.is-done,.reca-tab-leaf.done,.reca-tab-leaf.repaired,.reca-tab-repair.is-done{filter:saturate(.62) brightness(.94);opacity:.9}
.reca-tab-inspector-id,.reca-tab-inspector-section>strong{color:#94a198}.reca-tab-inspector-section p{color:#b5c0b7}.reca-tab-record{color:#aeb9b0}.reca-tab-empty,.reca-tab-preview,.reca-tab-final-copy p,.reca-tab-final-placeholder{color:#929f96}
@media(max-width:980px){.reca-tab-workspace{grid-template-columns:1fr}.reca-tab-graph-wrap{border-right:0;border-bottom:1px solid var(--line)}.reca-tab-meta{grid-template-columns:repeat(3,1fr)}.reca-tab-meta>div:first-child{grid-column:span 2}}@media(max-width:660px){.reca-tab-top{grid-template-columns:1fr}.reca-tab-stages{overflow-x:auto;grid-template-columns:repeat(5,90px)}.reca-tab-meta{grid-template-columns:1fr 1fr}.reca-tab-final{grid-template-columns:1fr;max-height:none;margin:0 12px 18px}}
`

const TONE_COLORS = ['#b9ff66', '#73d9e7', '#ffb45f', '#aa91ff']
const DEFAULT_STAGES = Object.freeze([
  { id: 'plan', label: 'Plan', status: 'pending' },
  { id: 'assets', label: 'Assets', status: 'pending' },
  { id: 'render', label: 'Render', status: 'pending' },
  { id: 'validate', label: 'Validate', status: 'pending' },
  { id: 'concat', label: 'Concat', status: 'pending' },
])

function calculateTabTreeLayout(value) {
  const parsed = Number(value)
  const shotCount = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1
  const shotGridWidth = (shotCount * TAB_TREE_SHOT_MIN_WIDTH) + ((shotCount - 1) * TAB_TREE_SHOT_GAP)
  return {
    shotCount,
    graphMinWidth: Math.max(TAB_TREE_MIN_WIDTH, TAB_TREE_HORIZONTAL_PADDING + shotGridWidth),
  }
}

function ensureTabStyles() {
  if (typeof document === 'undefined' || document.querySelector(`style[data-plugin-css="${TAB_STYLE_ID}"]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-reca-toolkit'
  tag.dataset.pluginCss = TAB_STYLE_ID
  tag.textContent = TAB_CSS
  document.head.appendChild(tag)
}

function flattenSegments(snapshot) {
  return (snapshot.shots || []).flatMap((shot, shotIndex) => (shot.segments || []).map((segment, segmentIndex) => ({
    ...segment,
    shotId: shot.id,
    shotTitle: shot.label || shot.title || shot.id,
    shotIndex,
    segmentIndex,
  })))
}

function emptySnapshot(runId) {
  return {
    runId: runId || null,
    title: runId ? `ReCA run ${runId}` : 'No ReCA run bound',
    story: '', state: runId ? 'connecting' : 'idle', status: 'pending', phase: runId ? 'connecting' : 'idle', progress: 0,
    stages: DEFAULT_STAGES,
    assets: [], shots: [], nodes: [],
    counts: { shots: 0, segments: 0, completedSegments: 0, assets: 0, repairs: 0 },
    film: { src: null, poster: null },
  }
}

function displayStatus(value) {
  return ({ active: 'running', running: 'running', pending: 'queued', done: 'ready', failed: 'failed', cancelled: 'cancelled', interrupted: 'interrupted' })[value] || value || 'queued'
}

function phaseAlias(node) {
  if (node?.id === 'plan') return 'PLAN'
  if (node?.id === 'assets') return 'VISUAL'
  return String(node?.label || node?.id || 'PHASE').trim().toUpperCase().slice(0, 8)
}

function phaseTone(node) {
  if (node?.id === 'plan') return 'plan'
  if (node?.id === 'assets') return 'visual'
  return 'neutral'
}

function leafStatus(segment) {
  if (segment.status === 'done' && segment.repairs && segment.repairs.length) return 'repaired'
  return segment.status || 'pending'
}

function durationLabel(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)}s` : 'duration pending'
}

function modeLabel(mode, runId) {
  if (!runId || mode === 'idle') return 'IDLE · waiting for a ReCA tool result'
  if (mode === 'run-not-found') return 'RUN NOT FOUND · polling stopped'
  if (mode === 'debug') return 'DEBUG OVERRIDE · explicit run binding'
  if (mode === 'connecting') return 'CONNECTING · locating Gateway run'
  if (mode === 'stale') return 'STALE · retrying through Harness Host'
  if (mode === 'error') return 'CONNECTION ERROR · retrying'
  return 'LIVE · real ReCA execution graph'
}

function modeBadge(mode) {
  if (mode === 'run-not-found') return 'RUN NOT FOUND'
  if (mode === 'debug') return 'DEBUG OVERRIDE'
  return String(mode || 'live').replace(/-/g, ' ').toUpperCase()
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function safeAssetBackground(url) {
  if (!url) return undefined
  return `url("${String(url).replace(/["\\]/g, (character) => encodeURIComponent(character))}")`
}

function createTabView(runtime) {
  const React = runtime && runtime.React
  const RecaTrace = runtime && runtime.RecaTrace
  if (!React || typeof React.createElement !== 'function') throw new Error('registerTab requires runtime.React')
  if (!RecaTrace || (!RecaTrace.useSessionRunBinding && !RecaTrace.useSessionRunId) || typeof RecaTrace.useTraceSnapshot !== 'function') {
    throw new Error('registerTab requires runtime.RecaTrace session and polling hooks')
  }
  const h = React.createElement

  function MetaItem({ label, value }) {
    return h('div', null, h('small', null, label), h('strong', { title: String(value) }, value))
  }

  function TextSection({ label, value }) {
    if (!hasText(value)) return null
    return h('section', { className: 'reca-tab-inspector-section' }, h('strong', null, label), h('p', null, value))
  }

  function ValidationRecords({ records }) {
    if (!Array.isArray(records) || records.length === 0) return null
    return h('section', { className: 'reca-tab-inspector-section' }, h('strong', null, 'Validation history'),
      h('div', { className: 'reca-tab-records' }, ...records.map((record, index) =>
        h('div', { className: `reca-tab-record ${record.passed ? 'is-pass' : 'is-flagged'}`, key: `${record.timestamp || index}-${index}` },
          h('b', null, `Attempt ${record.attempt ?? index + 1} · ${record.passed ? 'passed' : 'flagged'}${record.score != null ? ` · score ${record.score}` : ''}`),
          hasText(record.detail) ? `\n${record.detail}` : '',
        ),
      )),
    )
  }

  function RepairRecords({ records }) {
    if (!Array.isArray(records) || records.length === 0) return null
    return h('section', { className: 'reca-tab-inspector-section' }, h('strong', null, 'Repair history'),
      h('div', { className: 'reca-tab-records' }, ...records.map((record, index) =>
        h('div', { className: 'reca-tab-record', key: `${record.timestamp || index}-${index}` },
          h('b', null, `Attempt ${record.attempt ?? index + 1} · ${record.strategy || 'repair'}`),
          hasText(record.detail) ? `\n${record.detail}` : '',
        ),
      )),
    )
  }

  function NodeInspector({ node }) {
    if (!node) return h('div', { className: 'reca-tab-empty' }, 'Select a node after a real trace snapshot becomes available.')
    const videoUrl = node.videoUrl || null
    const imageUrl = node.imageUrl || node.posterUrl || null
    return h(React.Fragment, null,
      h('div', { className: 'reca-tab-inspector-head' },
        h('div', { className: 'reca-tab-inspector-kicker' }, `${String(node.kind || 'node').toUpperCase()} INSPECTOR`),
        h('h2', null, node.label || node.id),
        h('div', { className: 'reca-tab-inspector-id' }, node.id),
      ),
      h('div', { className: 'reca-tab-inspector-body' },
        videoUrl
          ? h('video', { className: 'reca-tab-media', controls: true, preload: 'metadata', poster: node.posterUrl || undefined, src: videoUrl })
          : imageUrl
            ? h('img', { className: 'reca-tab-media', alt: `${node.label || node.id} artifact`, src: imageUrl })
            : h('div', { className: 'reca-tab-preview' }, 'NO MEDIA PUBLISHED FOR THIS NODE'),
        h(TextSection, { label: 'Detail', value: node.detail }),
        h(TextSection, { label: 'Story', value: node.story }),
        h(TextSection, { label: 'Prompt', value: node.prompt }),
        h(TextSection, { label: 'Story goal', value: node.storyGoal }),
        h(TextSection, { label: 'Visual intent', value: node.visualIntent }),
        h(TextSection, { label: 'Start state', value: node.startState }),
        h(TextSection, { label: 'End state', value: node.endState }),
        h(ValidationRecords, { records: node.validations }),
        h(RepairRecords, { records: node.repairs }),
        h('div', { className: 'reca-tab-facts' },
          h('span', null, node.kind || 'node'), h('span', null, displayStatus(node.status)),
          node.durationS != null ? h('span', null, durationLabel(node.durationS)) : null,
          node.requestType ? h('span', null, node.requestType) : null,
          node.score != null ? h('span', null, `validator ${node.score}`) : null,
          node.strategy ? h('span', null, node.strategy) : null,
          node.attempt != null ? h('span', null, `attempt ${node.attempt}`) : null,
        ),
      ),
    )
  }

  function RecaTabView({ useSession, sessionId, connection }) {
    ensureTabStyles()
    const sessionHook = typeof useSession === 'function' ? useSession : () => null
    const binding = typeof RecaTrace.useSessionRunBinding === 'function'
      ? RecaTrace.useSessionRunBinding(sessionHook, sessionId)
      : { runId: RecaTrace.useSessionRunId(sessionHook, sessionId), sessionId }
    const runId = binding?.runId || null
    const trace = RecaTrace.useTraceSnapshot({ connection, binding, runId, fallback: null, intervalMs: 1600, active: true, visible: true })
    const snapshot = trace.snapshot || emptySnapshot(runId)
    const shots = Array.isArray(snapshot.shots) ? snapshot.shots : []
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : []
    const nodeById = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
    const segments = React.useMemo(() => flattenSegments(snapshot), [snapshot])
    const [selectedId, setSelectedId] = React.useState(null)
    const graphWrapRef = React.useRef(null)
    const treeLayout = calculateTabTreeLayout(shots.length)

    React.useEffect(() => { setSelectedId(null) }, [runId])
    React.useEffect(() => {
      if (!selectedId || !nodeById.has(selectedId)) setSelectedId(nodeById.has('root') ? 'root' : (nodes[0]?.id || null))
    }, [nodeById, nodes, selectedId])
    React.useEffect(() => {
      const graphWrap = graphWrapRef.current
      if (!graphWrap) return
      graphWrap.scrollLeft = Math.max(0, (graphWrap.scrollWidth - graphWrap.clientWidth) / 2)
    }, [runId, treeLayout.shotCount])

    const selected = nodeById.get(selectedId) || null
    const counts = snapshot.counts || {
      shots: shots.length, segments: segments.length,
      completedSegments: segments.filter((segment) => segment.status === 'done').length,
      assets: (snapshot.assets || []).length,
      repairs: segments.reduce((total, segment) => total + (segment.repairs || []).length, 0),
    }
    const progress = Number.isFinite(Number(snapshot.progress)) ? Math.max(0, Math.min(100, Number(snapshot.progress))) : 0
    const complete = snapshot.status === 'done' || snapshot.state === 'succeeded' || Boolean(snapshot.film?.src)
    const mode = runId ? (trace.mode || 'connecting') : 'idle'
    const rootNode = nodeById.get('root') || null
    const phaseNodes = ['plan', 'assets'].map((id) => nodeById.get(id)).filter(Boolean)
    const concatNode = nodeById.get('concat') || null

    return h('section', { className: 'reca-tab-surface', 'data-reca-surface': 'conversation-view', 'data-reca-mode': mode, 'data-reca-run-id': runId || undefined },
      h('header', { className: 'reca-tab-top' },
        h('div', null,
          h('div', { className: `reca-tab-eyebrow is-${mode}` }, h('span', { className: 'reca-tab-dot' }), modeLabel(mode, runId)),
          h('div', { className: 'reca-tab-title' }, h('strong', null, snapshot.title), h('span', null, runId || 'no bound run')),
        ),
        h('div', { className: 'reca-tab-controls' },
          h('span', { className: `reca-tab-mode is-${mode}` }, modeBadge(mode)),
          h('span', { className: 'reca-tab-poll' }, mode === 'run-not-found' ? 'polling stopped' : (runId ? 'poll 1.6s · no LLM' : 'start with reca_create_video')),
        ),
      ),
      trace.error ? h('div', { className: 'reca-tab-error', role: 'status' }, trace.error, trace.snapshot ? ' · last useful snapshot remains visible' : '') : null,
      h('div', { className: 'reca-tab-stages', 'aria-label': 'ReCA stages' },
        ...(Array.isArray(snapshot.stages) && snapshot.stages.length ? snapshot.stages : DEFAULT_STAGES).map((stage) => h('div', { className: `reca-tab-stage ${stage.status || 'pending'}`, key: stage.id }, stage.label)),
      ),
      h('div', { className: 'reca-tab-meta' },
        h(MetaItem, { label: 'Run', value: runId || 'waiting' }),
        h(MetaItem, { label: 'Progress', value: `${progress}% · ${snapshot.phase || snapshot.state || 'queued'}` }),
        h(MetaItem, { label: 'Plan', value: `${counts.shots || 0} shots · ${counts.segments || 0} segments` }),
        h(MetaItem, { label: 'Rendered', value: `${counts.completedSegments || 0}/${counts.segments || 0} · ${counts.repairs || 0} repairs` }),
        h(MetaItem, { label: 'Source', value: runId ? 'ReCA Gateway via Host' : 'No run bound' }),
      ),
      h('section', { className: 'reca-tab-assets' },
        h('div', { className: 'reca-tab-section-label' }, h('span', { title: 'Shared visual state' }, 'VISUAL'), h('em', null, `${counts.assets || 0} plan assets and anchors`)),
        (snapshot.assets || []).length
          ? h('div', { className: 'reca-tab-asset-grid' }, ...(snapshot.assets || []).map((asset, index) => {
            const nodeId = `asset:${asset.id}`
            return h('button', {
              className: `reca-tab-asset ${asset.status || 'pending'} ${selectedId === nodeId ? 'selected' : ''}`,
              key: asset.id, type: 'button', title: asset.prompt || asset.label,
              'data-reca-node-id': nodeId,
              onClick: () => setSelectedId(nodeId),
              style: { '--asset-color': TONE_COLORS[index % TONE_COLORS.length], ...(asset.imageUrl ? { '--asset-image': safeAssetBackground(asset.imageUrl) } : {}) },
            }, h('strong', null, asset.label || asset.id), h('small', null, asset.kind || 'asset'))
          }))
          : h('div', { className: 'reca-tab-empty' }, runId ? 'Waiting for render_plan.json and shared assets from this run.' : 'No run is bound to this Harness session.'),
      ),
      h('div', { className: 'reca-tab-workspace' },
        h('div', { className: 'reca-tab-graph-wrap', ref: graphWrapRef },
          h('div', {
            className: 'reca-tab-graph',
            'data-reca-tree-shot-count': treeLayout.shotCount,
            style: {
              '--shot-count': treeLayout.shotCount,
              '--reca-tab-shot-gap': `${TAB_TREE_SHOT_GAP}px`,
              '--reca-tab-tree-min-width': `${treeLayout.graphMinWidth}px`,
            },
          },
            rootNode || phaseNodes.length ? h('div', { className: `reca-tab-tree-head${rootNode ? ' has-root' : ''}` },
              rootNode ? h('button', { type: 'button', className: `reca-tab-root is-${rootNode.status || 'pending'} ${complete ? 'done' : ''} ${selectedId === rootNode.id ? 'selected' : ''}`, 'data-reca-node-id': rootNode.id, onClick: () => setSelectedId(rootNode.id), title: rootNode.detail || rootNode.label },
                h('small', null, `ROOT · ${String(rootNode.status || snapshot.state || 'queued').toUpperCase()}`),
                h('strong', null, rootNode.label || snapshot.title),
                h('span', null, rootNode.summary || rootNode.detail || `${counts.shots || 0} shots · ${counts.segments || 0} segments`),
              ) : null,
              phaseNodes.length ? h('div', { className: 'reca-tab-phase-row' }, ...phaseNodes.map((node) =>
                h('button', { key: node.id, type: 'button', className: `reca-tab-phase tone-${phaseTone(node)} ${node.status || 'pending'} ${selectedId === node.id ? 'selected' : ''}`, 'data-reca-node-id': node.id, 'aria-label': `${node.label}, ${displayStatus(node.status)}`, onClick: () => setSelectedId(node.id), title: `${node.label} · ${node.meta || displayStatus(node.status)}${node.detail ? `\n${node.detail}` : ''}` }, phaseAlias(node)),
              )) : null,
            ) : null,
            shots.length
              ? h('div', { className: 'reca-tab-shot-grid' },
                ...shots.map((shot, shotIndex) => {
                  const shotNode = nodeById.get(shot.id)
                  const anchorNodeId = shot.anchor ? `anchor:${shot.anchor.id}` : null
                  return h('section', { className: 'reca-tab-shot', key: shot.id, 'data-reca-parent-id': 'root' },
                    h('div', { className: 'reca-tab-shot-head-wrap' },
                      h('button', { type: 'button', className: `reca-tab-shot-head is-${shot.status || 'pending'} ${shot.anchor ? 'has-anchor' : ''} ${selectedId === shot.id ? 'selected' : ''}`, 'data-reca-node-id': shot.id, onClick: () => setSelectedId(shot.id), title: shotNode?.detail || shot.storyGoal || shot.label },
                        h('small', null, `SHOT ${String(shotIndex + 1).padStart(2, '0')} · ${durationLabel(shot.durationS)}`),
                        h('strong', null, shot.label || shot.title || shot.id),
                        h('span', null, `${(shot.segments || []).length} serial segments · ${displayStatus(shot.status)}`),
                      ),
                      shot.anchor ? h('button', { type: 'button', className: `reca-tab-anchor ${selectedId === anchorNodeId ? 'selected' : ''}`, 'data-reca-node-id': anchorNodeId, 'aria-label': `Select ${shot.anchor.id}`, title: `${shot.anchor.id} · ${displayStatus(shot.anchor.status)}`, onClick: () => setSelectedId(anchorNodeId), style: shot.anchor.imageUrl ? { backgroundImage: safeAssetBackground(shot.anchor.imageUrl) } : undefined }) : null,
                    ),
                    h('div', { className: 'reca-tab-chain' }, ...(shot.segments || []).map((segment, segmentIndex) => {
                      const status = leafStatus(segment)
                      return h('div', { className: 'reca-tab-node-wrap', key: segment.id },
                        h('button', { className: `reca-tab-leaf ${status} ${selectedId === segment.id ? 'selected' : ''}`, type: 'button', 'data-reca-node-id': segment.id, onClick: () => setSelectedId(segment.id), title: segment.prompt || segment.label },
                          h('span', { className: 'reca-tab-leaf-index' }, String(segmentIndex + 1).padStart(2, '0')),
                          h('span', { className: 'reca-tab-leaf-copy' }, h('strong', null, segment.label || segment.id), h('small', null, `${segment.requestType || 'segment'} · ${durationLabel(segment.durationS)}`)),
                          h('span', { className: 'reca-tab-node-state' }, displayStatus(status)),
                        ),
                        segment.repairs?.length ? h('div', { className: 'reca-tab-repairs' }, ...segment.repairs.map((repair, repairIndex) => {
                          const repairId = `repair:${segment.id}:${repair.attempt || repairIndex + 1}`
                          const repairStatus = nodeById.get(repairId)?.status || 'active'
                          const repairAttempt = repair.attempt || repairIndex + 1
                          const repairAlias = ['failed', 'flagged'].includes(repairStatus) ? 'FAIL' : 'FIX'
                          const repairNumber = String(repairAttempt).padStart(2, '0')
                          return h('button', { type: 'button', className: `reca-tab-repair is-${repairStatus} ${selectedId === repairId ? 'selected' : ''}`, key: repairId, 'data-reca-node-id': repairId, 'aria-label': `Repair ${repairAttempt}, ${displayStatus(repairStatus)}`, onClick: () => setSelectedId(repairId), title: `${repair.strategy || 'repair branch'}${repair.detail ? `\n${repair.detail}` : ''}` }, `${repairAlias} ${repairNumber}`)
                        })) : null,
                      )
                    })),
                  )
                }),
              )
              : h('div', { className: 'reca-tab-empty' }, runId ? 'Waiting for the narrative and render plan from this run.' : 'Start ReCA to create an execution graph.'),
          ),
        ),
        h('aside', { className: 'reca-tab-inspector' }, h(NodeInspector, { node: selected })),
      ),
      concatNode ? h('section', { className: `reca-tab-final ${snapshot.film?.src ? '' : 'waiting'}` },
        h('button', { type: 'button', className: `reca-tab-final-copy ${selectedId === concatNode.id ? 'selected' : ''}`, 'data-reca-node-id': concatNode.id, onClick: () => setSelectedId(concatNode.id), title: concatNode.detail || concatNode.label },
          h('small', null, snapshot.film?.src ? 'FINAL ARTIFACT READY' : 'FINAL ARTIFACT · WAITING'),
          h('h2', null, concatNode.label || 'Final concat'),
          h('p', null, concatNode.summary || concatNode.detail),
          h('div', { className: 'reca-tab-facts' }, h('span', null, `${counts.shots || 0} shots`), h('span', null, `${counts.segments || 0} segments`), h('span', null, `${counts.repairs || 0} repairs`)),
        ),
        snapshot.film?.src
          ? h('video', { controls: true, preload: 'metadata', poster: snapshot.film.poster || undefined, src: snapshot.film.src })
          : h('div', { className: 'reca-tab-final-placeholder' }, 'NO FINAL VIDEO PUBLISHED'),
      ) : null,
    )
  }

  RecaTabView.displayName = 'RecaTabView'
  return RecaTabView
}

function registerTab(ctx, runtime) {
  if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function' || typeof ctx.slots.register !== 'function') {
    throw new Error('registerTab requires the Harness slots service')
  }
  ensureTabStyles()
  const RecaTabView = createTabView(runtime)
  return ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'reca',
    order: 20,
    label: () => 'ReCA',
    inject: () => ({
      connection: typeof ctx.get === 'function' ? ctx.get('connection') : ctx.connection,
    }),
  }, RecaTabView))
}

module.exports = {
  TAB_CSS,
  TAB_STYLE_ID,
  calculateTabTreeLayout,
  createTabView,
  registerTab,
}
