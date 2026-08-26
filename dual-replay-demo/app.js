const state = {
  catalog: null,
  currentCase: null,
  manifest: null,
  time: 0,
  duration: 1,
  nextEvent: 0,
  playing: false,
  speed: 1,
  lastFrame: null,
  loadSeq: 0,
  traceCount: 0,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function modelSummary(render = {}) {
  return [...new Set(Object.values(render).filter(Boolean))].join(" + ") || "recorded providers";
}

function renderFacts() {
  const data = state.manifest;
  $("#runName").textContent = data.run_id;
  $("#statRun").textContent = data.run_id;
  $("#statPlan").textContent = `${data.counts.shots} shots · ${data.counts.segments} segments`;
  $("#statAssets").textContent = `${data.counts.assets} generated images`;
  $("#statRepairs").textContent = `${data.counts.repairs} repaired leaves`;
  $("#statModels").textContent = modelSummary(data.run.render);
  $("#rootTitle").textContent = "Waiting for plan";
  $("#artifactNote").textContent = `${data.recording.raw_event_count} raw events · v${data.version} trace`;
  $("#finalVideo").src = data.film.src;
  $("#finalVideo").poster = data.film.poster;
  $("#finalFacts").innerHTML = [
    `${data.film.duration_s.toFixed(1)}s final`,
    data.run.resolution,
    `${data.counts.shots} shots`,
    `${data.counts.segments} segments`,
    `${data.counts.repairs} repaired leaves`,
  ].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function renderCasePicker() {
  $("#casePicker").innerHTML = state.catalog.cases.map((item, index) => `
    <button type="button" class="case-card ${index === 0 ? "active" : ""}" data-case="${escapeHtml(item.slug)}">
      <img src="${escapeHtml(item.poster)}" alt="" loading="${index === 0 ? "eager" : "lazy"}">
      <span class="case-card-copy">
        <small>${escapeHtml(item.kicker)}</small>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.summary)}</span>
      </span>
    </button>
  `).join("");
  $$("[data-case]").forEach((button) => button.addEventListener("click", () => loadCase(button.dataset.case)));
}

function renderMemory() {
  $("#memoryRail").innerHTML = state.manifest.memory.map((item) => `
    <button type="button" class="memory-card pending unborn" data-node-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.src)}" alt="" loading="lazy">
      <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.kind)}</small></span>
    </button>
  `).join("");
}

function renderTree() {
  const { shots, leaves, anchors } = state.manifest;
  const leafMap = Object.fromEntries(leaves.map((leaf) => [leaf.id, leaf]));
  const anchorMap = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor]));
  $("#shotGrid").style.setProperty("--shot-count", shots.length);
  $("#shotGrid").innerHTML = shots.map((shot, shotIndex) => {
    const anchor = anchorMap[shot.anchor_id];
    const leafButtons = shot.leaf_ids.map((leafId) => {
      const leaf = leafMap[leafId];
      return `
        <button type="button" class="leaf-node node pending unborn ${leaf.had_repair ? "has-repair" : ""}" data-node-id="${escapeHtml(leaf.id)}">
          <span class="leaf-index">${String(leaf.index + 1).padStart(2, "0")}</span>
          <span class="leaf-copy"><strong>${escapeHtml(leaf.id.replace(/^seg_/, ""))}</strong><small>${escapeHtml(leaf.mode.toUpperCase())} · ${leaf.duration_s.toFixed(1)}s</small></span>
          <span class="node-state">pending</span>
        </button>
        ${leaf.had_repair ? `<div class="repair-branch unborn" data-repair-for="${escapeHtml(leaf.id)}"><span>↳ repair attempt</span><small>waiting</small></div>` : ""}`;
    }).join("");
    const anchorStyle = anchor ? `style="background-image:url('${escapeHtml(anchor.src)}')"` : "";
    return `
      <section class="shot-column unborn" data-shot-id="${escapeHtml(shot.id)}">
        <div class="shot-head pending" data-shot-head="${escapeHtml(shot.id)}">
          <span class="node-label">SHOT ${String(shotIndex + 1).padStart(2, "0")} · ${shot.planned_duration_s}s PLAN</span>
          <strong>${escapeHtml(shot.id.replace(/^shot\d+_/, "").replaceAll("_", " "))}</strong>
          <small>${shot.leaf_ids.length} serial leaves</small>
        </div>
        <div class="leaf-chain">
          ${anchor ? `<button type="button" class="anchor-node node pending unborn" data-node-id="${escapeHtml(anchor.id)}" ${anchorStyle}><strong>${escapeHtml(anchor.id)}</strong><small>start anchor · pending</small></button>` : ""}
          ${leafButtons}
        </div>
      </section>`;
  }).join("");

  $$('[data-node-id]').forEach((element) => {
    element.onclick = () => inspectNode(element.dataset.nodeId);
    element.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") inspectNode(element.dataset.nodeId);
    };
  });
}

function setNodeState(nodeId, status) {
  const element = document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!element) return;
  element.classList.remove("unborn");
  element.classList.remove("pending", "running", "done", "flagged", "repairing");
  element.classList.add(status);
  const label = element.querySelector(".node-state");
  if (label) label.textContent = status === "repairing" ? "repair" : status;
  if (element.classList.contains("anchor-node")) {
    const small = element.querySelector("small");
    if (small) small.textContent = `start anchor · ${status}`;
  }
}

function setShotState(shotId, status) {
  const head = document.querySelector(`[data-shot-head="${CSS.escape(shotId)}"]`);
  if (!head) return;
  head.closest(".shot-column")?.classList.remove("unborn");
  head.classList.remove("pending", "running", "done");
  head.classList.add(status);
}

function setStage(name) {
  const order = ["plan", "assets", "render", "validate", "concat"];
  const index = order.indexOf(name);
  $$("#stageChips span").forEach((chip, chipIndex) => {
    chip.classList.toggle("done", chipIndex < index);
    chip.classList.toggle("active", chipIndex === index);
  });
  const labels = { plan: "Planning the execution graph", assets: "Generating shared state", render: "Rendering parallel shots", validate: "Validating and repairing", concat: "Concatenating final film" };
  $("#stageLabel").textContent = labels[name] || "Ready";
}

function appendTape(event) {
  const tape = $("#tape");
  let html = "";
  if (event.type === "dsh.user_message" || event.type === "dsh.agent_message") {
    const user = event.type === "dsh.user_message";
    html = user ? `
      <article class="tape-entry dsh-turn user-turn">
        <div class="message-bubble">${escapeHtml(event.message)}</div>
      </article>` : `
      <article class="tape-entry dsh-turn agent-turn">
        <details class="think-row">
          <summary><span class="think-icon">✦</span><strong>Think</strong><i></i><span>识别 ReCA 工作流并组织下一次工具调用</span></summary>
          <p>根据当前任务状态选择创建、轮询或获取产物；回放仅展示过程摘要，不展示隐藏推理。</p>
        </details>
        <div class="assistant-mark">D</div>
        <div class="assistant-copy">${escapeHtml(event.message)}</div>
      </article>`;
  } else if (event.type.startsWith("dsh.tool")) {
    const success = ["succeeded", "running"].includes(event.status);
    html = `
      <article class="tape-entry tool-tree">
        <details class="tool-call" ${event.status === "running" ? "open" : ""}>
          <summary>
            <span class="tool-leading">⌁</span>
            <strong>${escapeHtml(event.tool)}</strong><i></i>
            <span class="tool-summary">${escapeHtml(event.detail)}</span>
            <span class="tool-status ${success ? "succeeded" : ""}">${escapeHtml(event.status)}</span>
          </summary>
          <div class="tool-io">
            <div><b>IN</b><code>${escapeHtml(event.detail || "recorded request")}</code></div>
            <div><b>OUT</b><code>${escapeHtml(event.status || "pending")}</code></div>
          </div>
        </details>
        <div class="tool-child"><span></span>Inspect in trajectory</div>
      </article>`;
  }
  if (html) {
    tape.insertAdjacentHTML("beforeend", html);
    tape.scrollTop = tape.scrollHeight;
  }
}

function appendTrace(event, flavor = "") {
  const tape = $("#traceTape");
  const detail = event.detail || event.message || event.status || "event recorded";
  state.traceCount += 1;
  $("#traceCount").textContent = state.traceCount;
  tape.insertAdjacentHTML("beforeend", `
    <div class="trace-line ${flavor}">
      <span class="trace-seq">${String(state.traceCount).padStart(2, "0")}</span>
      <span class="trace-branch"></span>
      <span class="trace-copy"><strong>${escapeHtml(event.label || event.type)}</strong><small>${escapeHtml(detail)}</small></span>
      <em>${escapeHtml(event.source || "reca")}</em>
    </div>`);
  tape.scrollTop = tape.scrollHeight;
}

function applyEvent(event) {
  if (event.source === "dsh") {
    appendTape(event);
    appendTrace(event, "dsh");
    $("#sessionState").textContent = event.status || "active";
    $("#typingRow em").textContent = event.type.includes("result") ? "tool result received" : "processing run state";
  } else {
    const flavor = event.type.includes("flagged") ? "warning" : event.type.includes("repair") ? "repair" : "";
    appendTrace(event, flavor);
  }

  switch (event.type) {
    case "reca.plan.start":
      setStage("plan");
      setNodeState("root", "running");
      $("#rootMeta").textContent = "Recursive planner is decomposing the story";
      break;
    case "reca.plan.ready":
      state.manifest.shots.forEach((shot) => setShotState(shot.id, "running"));
      $(".parallel-trunk")?.classList.add("active");
      $("#rootTitle").textContent = `${state.manifest.counts.shots} shots · ${state.manifest.counts.segments} segments`;
      $("#rootMeta").textContent = event.label;
      break;
    case "reca.asset.ready":
      setStage("assets");
      setNodeState(event.node_id, "done");
      break;
    case "reca.anchor.ready":
      setStage("assets");
      setNodeState(event.node_id, "done");
      break;
    case "reca.segment.start":
      setStage("render");
      setNodeState(event.node_id, "running");
      setShotState(event.shot_id, "running");
      break;
    case "reca.validation.flagged":
      setStage("validate");
      setNodeState(event.node_id, "flagged");
      inspectNode(event.node_id);
      break;
    case "reca.repair.start":
      setStage("validate");
      setNodeState(event.node_id, "repairing");
      revealRepair(event.node_id, "running");
      break;
    case "reca.validation.pass":
      setStage("validate");
      if (event.node_id) revealRepair(event.node_id, "done");
      break;
    case "reca.segment.ready": {
      setStage("render");
      setNodeState(event.node_id, "done");
      const repair = document.querySelector(`[data-repair-for="${CSS.escape(event.node_id)}"]`);
      if (repair && !repair.classList.contains("unborn")) revealRepair(event.node_id, "done");
      const shot = state.manifest.shots.find((item) => item.id === event.shot_id);
      if (shot && shot.leaf_ids.every((id) => document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.classList.contains("done"))) {
        setShotState(event.shot_id, "done");
      }
      break;
    }
    case "reca.concat.start":
      setStage("concat");
      break;
    case "reca.final.ready":
      setNodeState("root", "done");
      $$("#stageChips span").forEach((chip) => { chip.classList.remove("active"); chip.classList.add("done"); });
      $("#rootMeta").textContent = `final.mp4 · ${state.manifest.film.duration_s.toFixed(1)}s`;
      $("#stageLabel").textContent = "Run complete";
      $("#finale").hidden = false;
      break;
  }
}

function revealRepair(nodeId, status) {
  const repair = document.querySelector(`[data-repair-for="${CSS.escape(nodeId)}"]`);
  if (!repair) return;
  repair.classList.remove("unborn", "running", "done");
  repair.classList.add(status);
  const label = repair.querySelector("small");
  if (label) label.textContent = status === "done" ? "accepted" : "rerendering";
}

function inspectNode(nodeId) {
  const data = state.manifest;
  const leaf = data.leaves.find((item) => item.id === nodeId);
  const anchor = data.anchors.find((item) => item.id === nodeId);
  const memory = data.memory.find((item) => item.id === nodeId);
  const shot = data.shots.find((item) => item.id === nodeId);
  let item = leaf || anchor || memory || shot;
  if (nodeId === "root") item = { id: data.run_id };
  if (!item) return;

  const type = leaf ? "SEGMENT LEAF" : anchor ? "BOUNDARY ANCHOR" : memory ? "STATE MEMORY" : shot ? "SHOT PLAN" : "ROOT OUTPUT";
  $("#inspectorType").textContent = type;
  $("#inspectorTitle").textContent = item.id;
  $("#inspectorText").textContent = leaf?.prompt || anchor?.prompt || memory?.prompt || shot?.story_goal || data.story;
  const facts = [];
  if (leaf) facts.push(leaf.mode.toUpperCase(), `${leaf.duration_s.toFixed(1)}s`, `anchor: ${leaf.start_anchor || "previous tail"}`, `${leaf.validation.length} validator events`);
  if (anchor) facts.push(`shot: ${anchor.shot_id}`, ...Object.entries(anchor.references || {}).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`));
  if (memory) facts.push(memory.kind, "shared state");
  if (shot) facts.push(`${shot.leaf_ids.length} leaves`, `${shot.duration_s.toFixed(1)}s actual`);
  $("#inspectorFacts").innerHTML = facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("");

  const media = $("#inspectorMedia");
  media.classList.remove("placeholder");
  if (leaf) {
    media.innerHTML = `<div class="leaf-media-grid"><video src="${escapeHtml(leaf.src)}" controls playsinline muted preload="metadata"></video><img src="${escapeHtml(leaf.tail_src)}" alt="Tail frame of ${escapeHtml(leaf.id)}"></div>`;
  } else if (anchor || memory) {
    media.innerHTML = `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.id)}">`;
  } else if (nodeId === "root") {
    media.innerHTML = `<video src="${escapeHtml(data.film.src)}" poster="${escapeHtml(data.film.poster)}" controls playsinline preload="metadata"></video>`;
  } else {
    media.innerHTML = `<span>SHOT PLAN</span>`;
    media.classList.add("placeholder");
  }
}

function resetReplay() {
  state.time = 0;
  state.nextEvent = 0;
  state.traceCount = 0;
  $("#tape").innerHTML = "";
  $("#traceTape").innerHTML = "";
  $("#traceCount").textContent = "0";
  $("#finale").hidden = true;
  $("#sessionState").textContent = "waiting";
  $("#rootMeta").textContent = "DSH has not submitted the run yet";
  $("#rootTitle").textContent = "Waiting for plan";
  $(".parallel-trunk")?.classList.remove("active");
  setNodeState("root", "pending");
  $$('[data-node-id]:not(#rootNode)').forEach((node) => {
    node.classList.remove("running", "done", "flagged", "repairing");
    node.classList.add("pending");
    node.classList.add("unborn");
    const label = node.querySelector(".node-state");
    if (label) label.textContent = "pending";
  });
  $$('[data-shot-head]').forEach((head) => { head.classList.remove("running", "done"); head.classList.add("pending"); });
  $$(".shot-column").forEach((shot) => shot.classList.add("unborn"));
  $$(".repair-branch").forEach((repair) => { repair.classList.remove("running", "done"); repair.classList.add("unborn"); });
  $$("#stageChips span").forEach((chip) => chip.classList.remove("active", "done"));
  $("#stageLabel").textContent = "Ready";
  $("#inspectorType").textContent = "SELECT A NODE";
  $("#inspectorTitle").textContent = "Inspect the real context behind any leaf";
  $("#inspectorText").textContent = "点击 Anchor、Segment 或 State Memory，查看它使用的 Prompt、首帧、尾帧、视频和验证记录。";
  $("#inspectorFacts").innerHTML = "";
  $("#inspectorMedia").className = "inspector-media placeholder";
  $("#inspectorMedia").innerHTML = "<span>MEDIA PREVIEW</span>";
  updateClock();
}

function replayTo(time) {
  resetReplay();
  state.time = time;
  while (state.nextEvent < state.manifest.events.length && state.manifest.events[state.nextEvent].t <= state.time) {
    applyEvent(state.manifest.events[state.nextEvent]);
    state.nextEvent += 1;
  }
  updateClock();
}

function updateClock() {
  $("#clock").textContent = `${formatTime(state.time)} / ${formatTime(state.duration)}`;
  $("#scrubber").value = Math.round((state.time / state.duration) * 1000);
  $("#playButton").textContent = state.playing ? "Ⅱ" : "▶";
  $("#playButton").setAttribute("aria-label", state.playing ? "Pause replay" : "Play replay");
}

function frame(now) {
  if (state.lastFrame === null) state.lastFrame = now;
  const delta = Math.min((now - state.lastFrame) / 1000, 0.1);
  state.lastFrame = now;
  if (state.playing && state.manifest) {
    state.time = Math.min(state.duration, state.time + delta * state.speed);
    while (state.nextEvent < state.manifest.events.length && state.manifest.events[state.nextEvent].t <= state.time) {
      applyEvent(state.manifest.events[state.nextEvent]);
      state.nextEvent += 1;
    }
    if (state.time >= state.duration) state.playing = false;
    updateClock();
  }
  requestAnimationFrame(frame);
}

function bindControls() {
  $("#playButton").addEventListener("click", () => {
    if (state.time >= state.duration) resetReplay();
    state.playing = !state.playing;
    updateClock();
  });
  $("#restartButton").addEventListener("click", () => { resetReplay(); state.playing = true; updateClock(); });
  $("#scrubber").addEventListener("input", (event) => replayTo((Number(event.target.value) / 1000) * state.duration));
  $$("[data-speed]").forEach((button) => button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    $$("[data-speed]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  $$("[data-dsh-view]").forEach((button) => button.addEventListener("click", () => {
    const view = button.dataset.dshView;
    $$("[data-dsh-view]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    $("#chatView").classList.toggle("active", view === "chat");
    $("#chatView").hidden = view !== "chat";
    $("#traceView").classList.toggle("active", view === "trace");
    $("#traceView").hidden = view !== "trace";
  }));
}

async function loadCase(slug) {
  const item = state.catalog.cases.find((entry) => entry.slug === slug);
  if (!item) return;
  const requestId = ++state.loadSeq;
  state.playing = false;
  $("#stageLabel").textContent = `Loading ${item.title}…`;
  const response = await fetch(item.manifest, { cache: "no-store" });
  if (!response.ok) throw new Error(`trace manifest ${response.status}`);
  const manifest = await response.json();
  if (requestId !== state.loadSeq) return;
  state.currentCase = item;
  state.manifest = manifest;
  state.duration = state.manifest.recording.replay_duration_s || Math.max(...state.manifest.events.map((event) => event.t), 1);
  $$("[data-case]").forEach((button) => button.classList.toggle("active", button.dataset.case === slug));
  renderFacts();
  renderMemory();
  renderTree();
  $("#artifactNote").textContent = `${item.title} · ${state.manifest.recording.event_source.replaceAll("_", " ")} · ${state.manifest.recording.raw_event_count} source events`;
  resetReplay();
  state.playing = false;
  updateClock();
  const replayPath = new URL("replay/", document.baseURI).pathname;
  const embedQuery = document.body.classList.contains("embed") ? "?embed=1" : "";
  history.replaceState(null, "", `${replayPath}${embedQuery}#${slug}`);
}

async function boot() {
  if (new URLSearchParams(location.search).get("embed") === "1") document.body.classList.add("embed");
  const response = await fetch("./data/index.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`case index ${response.status}`);
  state.catalog = await response.json();
  renderCasePicker();
  bindControls();
  const requested = location.hash.slice(1);
  const initial = state.catalog.cases.some((item) => item.slug === requested) ? requested : state.catalog.cases[0].slug;
  await loadCase(initial);
  requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  $("#stageLabel").textContent = "Replay data unavailable";
  $("#tape").innerHTML = `<div class="message-bubble">无法加载真实运行数据：${escapeHtml(error.message)}</div>`;
});
