(function () {
  const data = window.RECA_DEMO_DATA;
  const mount = document.querySelector('#recaMount');
  const stages = ['plan', 'assets', 'render', 'validate', 'concat'];
  const stageLabels = { plan: 'Plan', assets: 'Shared state', render: 'Parallel render', validate: 'Validate + repair', concat: 'Final concat' };
  const tones = { lime: '#b9ff66', cyan: '#73d9e7', amber: '#ffb45f', violet: '#aa91ff' };
  const segments = data.shots.flatMap((shot, shotIndex) => shot.segments.map((segment, segmentIndex) => ({ ...segment, shotTitle: shot.title, shotIndex, segmentIndex })));
  const completeAt = segments.length + 6;
  let cursor = 0;
  let selectedId = segments[0].id;
  let playing = true;
  let timer;

  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function phaseAt(value) {
    const validateAt = segments.length + 3;
    if (value < 1) return 'plan';
    if (value < 3) return 'assets';
    if (value < validateAt) return 'render';
    if (value < validateAt + 2) return 'validate';
    return 'concat';
  }

  function stageClass(stage) {
    const current = phaseAt(cursor);
    const currentIndex = cursor >= completeAt ? stages.length : stages.indexOf(current);
    const index = stages.indexOf(stage);
    if (index < currentIndex) return 'reca-stage done';
    if (index === currentIndex) return 'reca-stage active';
    return 'reca-stage';
  }

  function segmentStatus(segment, index) {
    const startAt = index + 3;
    const validateAt = segments.length + 3;
    if (segment.repair && cursor === validateAt) return 'flagged';
    if (segment.repair && cursor >= validateAt + 1) return 'repaired';
    if (cursor < startAt) return 'pending';
    if (cursor === startAt) return 'running';
    return 'done';
  }

  function statusLabel(status) {
    return ({ pending: 'queued', running: 'rendering', flagged: 'flagged', repaired: 'repaired', done: 'ready' })[status] || status;
  }

  function meta(label, value) {
    return `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
  }

  function render() {
    const selected = segments.find((segment) => segment.id === selectedId) || segments[0];
    const phase = phaseAt(cursor);
    const complete = cursor >= completeAt;
    const progress = Math.min(100, Math.round(cursor / completeAt * 100));
    mount.innerHTML = `
      <section class="reca-tab-demo" data-reca-demo="standalone">
        <header class="reca-topline">
          <div>
            <div class="reca-eyebrow"><span class="reca-live-dot"></span>${complete ? 'Run complete' : 'Live execution graph'}</div>
            <div class="reca-title-row"><strong>${esc(data.title)}</strong><span>${esc(data.runId)}</span></div>
          </div>
          <div class="reca-controls">
            <button class="reca-control" type="button" data-action="reset">Reset</button>
            <button class="reca-control primary" type="button" data-action="play">${playing ? 'Pause trace' : (complete ? 'Replay trace' : 'Continue trace')}</button>
          </div>
        </header>
        <div class="reca-stagebar">${stages.map((stage) => `<div class="${stageClass(stage)}">${stageLabels[stage]}</div>`).join('')}</div>
        <div class="reca-meta">
          ${meta('Run', data.runId)}
          ${meta('Progress', `${progress}% · ${phase}`)}
          ${meta('Plan', `${data.shots.length} shots · ${segments.length} leaves`)}
          ${meta('Output', `${data.duration} · ${data.resolution}`)}
          ${meta('Models', data.models)}
        </div>
        <section class="reca-assets">
          <div class="reca-section-label"><span>Shared visual state</span><em>reused across parallel shots</em></div>
          <div class="reca-asset-grid">${data.assets.map((asset, index) => `
            <div class="reca-asset ${cursor > 1 || (cursor === 1 && index < 2) ? 'done' : ''}" style="--asset-color:${tones[asset.tone]}">
              <strong>${esc(asset.label)}</strong><small>${esc(asset.type)}</small>
            </div>`).join('')}</div>
        </section>
        <div class="reca-workspace">
          <div class="reca-graph-wrap">
            <div class="reca-graph">
              <div class="reca-root ${complete ? 'done' : ''}"><span class="orbit"></span><small>ROOT · ${complete ? 'SUCCEEDED' : phase.toUpperCase()}</small><strong>${esc(data.title)}</strong><span>${esc(data.subtitle)}</span></div>
              <div class="reca-trunk"></div>
              <div class="reca-shot-grid">${data.shots.map((shot, shotIndex) => `
                <section class="reca-shot">
                  <div class="reca-shot-head"><small>SHOT ${String(shotIndex + 1).padStart(2, '0')} · ${esc(shot.duration)}</small><strong>${esc(shot.title)}</strong><span>${shot.segments.length} serial leaves</span></div>
                  <div class="reca-chain">${shot.segments.map((segment, segmentIndex) => {
                    const globalIndex = segments.findIndex((item) => item.id === segment.id);
                    const status = segmentStatus(segment, globalIndex);
                    return `<button class="reca-leaf ${status} ${selectedId === segment.id ? 'selected' : ''}" type="button" data-node="${esc(segment.id)}"><span class="reca-leaf-index">${String(segmentIndex + 1).padStart(2, '0')}</span><span class="reca-leaf-copy"><strong>${esc(segment.label)}</strong><small>${esc(segment.mode)} · ${esc(segment.duration)}</small></span><span class="reca-node-state">${statusLabel(status)}</span></button>`;
                  }).join('')}</div>
                </section>`).join('')}</div>
            </div>
          </div>
          <aside class="reca-inspector">
            <div class="reca-inspector-head"><div class="reca-inspector-kicker">Selected leaf</div><h2>${esc(selected.label)}</h2><div class="reca-inspector-id">${esc(selected.shotTitle)} / ${esc(selected.id)}</div></div>
            <div class="reca-inspector-body">
              <p>${esc(selected.prompt)}</p>
              <div class="reca-facts"><span>${esc(selected.mode)}</span><span>${esc(selected.duration)}</span><span>validator ${esc(selected.score)}</span>${selected.repair ? '<span>1 repair branch</span>' : ''}</div>
              <div class="reca-preview"><span class="reca-preview-orb"></span></div>
              ${selected.repair ? '<div class="reca-inspector-note">Validator detected hand-geometry drift. ReCA kept the original leaf in the trace and accepted the repaired branch.</div>' : ''}
            </div>
          </aside>
        </div>
        <section class="reca-final ${complete ? '' : 'waiting'}">
          <div class="reca-final-copy"><small>${complete ? 'FINAL ARTIFACT READY' : 'FINAL ARTIFACT · WAITING'}</small><h2>The execution graph becomes the film.</h2><p>${complete ? 'Every accepted leaf is concatenated into one reviewable artifact without leaving the Harness session.' : 'The final film unlocks when validation and concat reach the root node.'}</p><div class="reca-facts"><span>${esc(data.duration)}</span><span>${esc(data.resolution)}</span><span>${segments.length} segments</span></div></div>
          <video controls preload="metadata" poster="${esc(data.film.poster)}" ${complete ? `src="${esc(data.film.src)}"` : ''}></video>
        </section>
      </section>`;

    mount.querySelector('[data-action="reset"]').onclick = () => { cursor = 0; playing = true; start(); render(); };
    mount.querySelector('[data-action="play"]').onclick = () => {
      if (cursor >= completeAt) cursor = 0;
      playing = !playing;
      start();
      render();
    };
    mount.querySelectorAll('[data-node]').forEach((button) => {
      button.onclick = () => { selectedId = button.dataset.node; render(); };
    });
  }

  function start() {
    clearInterval(timer);
    if (!playing) return;
    timer = setInterval(() => {
      cursor += 1;
      if (cursor >= completeAt) {
        cursor = completeAt;
        playing = false;
        clearInterval(timer);
      }
      render();
    }, 880);
  }

  render();
  start();
}());
