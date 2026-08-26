/* This source is wrapped as a Harness lazy-CJS client bundle by scripts/build.mjs. */
const React = require('react');
const h = React.createElement;

// __RECA_TRACE_RUNTIME__

const RECA_CSS = __RECA_CSS__;
const RECA_DEMO_SOURCE = __RECA_DATA__;
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
