import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adapter = require("../src/client-ui/runtime/trace-adapter.cjs");
const tabSurface = require("../src/client-ui/surfaces/tab.cjs");

const longStory = `story-${"S".repeat(520)}`;
const longPrompt = `prompt-${"P".repeat(620)}`;
const longValidation = `validation-${"V".repeat(460)}`;
const longRepair = `repair-${"R".repeat(480)}`;
const runId = "abc123def456";
const snapshot = adapter.normalizeRecaTraceSnapshot({
  runId,
  gatewayBaseUrl: "/reca-media",
  status: {
    run_id: runId,
    state: "succeeded",
    audit_state: "audited",
    artifact_manifest: {
      artifacts: [
        { kind: "final_video", path: "run/final.mp4", mime: "video/mp4", status: "ready" },
      ],
    },
  },
  request: { story: longStory },
  renderPlan: {
    shots: [{
      id: "shot_01",
      duration_s: 6,
      story_goal: `goal-${"G".repeat(420)}`,
      visual_intent: `intent-${"I".repeat(420)}`,
      start_state: `start-${"A".repeat(420)}`,
      end_state: `end-${"E".repeat(420)}`,
    }],
    portrait_plan: [{
      id: "hero",
      kind: "portrait",
      image_request: {
        name: "Hero",
        prompt: `asset-${"Z".repeat(500)}`,
        output_path: `/.dsh_runs/${runId}/run/portraits/hero.png`,
      },
    }],
    boundary_anchors: [{
      id: "a1_start",
      shot_id: "shot_01",
      image_request: {
        prompt: `anchor-${"K".repeat(500)}`,
        output_path: `/.dsh_runs/${runId}/run/anchors/a1_start.png`,
      },
    }],
    segments: {
      seg_01: {
        id: "seg_01",
        shot_id: "shot_01",
        segment_index_in_shot: 0,
        request_type: "ReferenceSerialSegmentRequest",
        end_state: `segment-end-${"Q".repeat(420)}`,
        segment_request: {
          prompt: longPrompt,
          duration_s: 6,
          output_path: `/.dsh_runs/${runId}/run/segments/seg_01.mp4`,
        },
      },
    },
  },
  events: [
    { ts: 1, type: "reca.segment.start", node_id: "seg_01" },
    { ts: 2, type: "reca.repair.start", node_id: "seg_01", attempt: 1, strategy: "regenerate", detail: longRepair },
    { ts: 3, type: "reca.validation.pass", node_id: "seg_01", attempt: 2, score: 0.98, detail: longValidation },
    { ts: 4, type: "reca.segment.ready", node_id: "seg_01" },
  ],
});

const node = (id) => snapshot.nodes.find((item) => item.id === id);
assert.equal(node("root").detail, longStory);
assert.ok(node("root").summary.length < node("root").detail.length);
assert.equal(node("seg_01").prompt, longPrompt);
assert.ok(node("seg_01").summary.length < node("seg_01").prompt.length);
assert.equal(node("seg_01").validations[0].detail, longValidation);
assert.equal(node("seg_01").repairs[0].detail, longRepair);
assert.equal(node("repair:seg_01:1").detail, longRepair);
assert.match(node("seg_01").videoUrl, /^\/reca-media\/v1\/runs\//);
assert.match(snapshot.film.src, /^\/reca-media\/v1\/runs\//);

const surfaceNames = ["tab", "overlay"];
const surfaces = Object.fromEntries(await Promise.all(surfaceNames.map(async (name) => [
  name,
  await readFile(resolve(root, `src/client-ui/surfaces/${name}.cjs`), "utf8"),
])));

for (const [name, source] of Object.entries(surfaces)) {
  assert.doesNotMatch(source, /DEMO_(?:TRACE|SNAPSHOT|POSTER)|embedded demo|Selected demo/i, `${name} contains a demo fallback`);
  assert.match(source, /text-overflow:ellipsis/, `${name} must clamp card text`);
  assert.match(source, /max-height:/, `${name} must bound card or inspector height`);
  assert.match(source, /controls:\s*true/, `${name} inspector must preview real video with controls`);
  assert.match(source, /NO (?:MEDIA|FINAL VIDEO) PUBLISHED/, `${name} needs a neutral no-media state`);
  assert.match(source, /run-not-found/, `${name} must label terminal missing-run state`);
}

assert.match(surfaces.tab, /onClick:\s*\(\) => setSelectedId\(rootNode\.id\)/);
assert.match(surfaces.tab, /onClick:\s*\(\) => setSelectedId\(anchorNodeId\)/);
assert.match(surfaces.tab, /onClick:\s*\(\) => setSelectedId\(repairId\)/);
assert.match(surfaces.overlay, /active:\s*open/);

assert.deepEqual(tabSurface.calculateTabTreeLayout(1), { shotCount: 1, graphMinWidth: 780 });
assert.deepEqual(tabSurface.calculateTabTreeLayout(4), { shotCount: 4, graphMinWidth: 780 });
assert.deepEqual(tabSurface.calculateTabTreeLayout(5), { shotCount: 5, graphMinWidth: 967 });
assert.deepEqual(tabSurface.calculateTabTreeLayout(10), { shotCount: 10, graphMinWidth: 1902 });
assert.deepEqual(tabSurface.calculateTabTreeLayout(12), { shotCount: 12, graphMinWidth: 2276 });
assert.deepEqual(tabSurface.calculateTabTreeLayout(Number.NaN), { shotCount: 1, graphMinWidth: 780 });
assert.doesNotMatch(surfaces.tab, /reca-tab-trunk|margin:0 12\.5%/, "tab must not use the former four-column trunk");
assert.match(surfaces.tab, /reca-tab-shot:not\(:last-child\):after/, "adjacent shot centers need explicit connector segments");
assert.match(surfaces.tab, /width:calc\(100% \+ var\(--reca-tab-shot-gap,12px\)\)/, "connector segments must include the grid gap");
assert.match(surfaces.tab, /reca-tab-tree-head:after/, "root needs a vertical spine to the shot connectors");
assert.match(surfaces.tab, /\.reca-tab-surface\{--bg:#000/, "tree surface must be harmonious on a pure black canvas");
assert.match(surfaces.tab, /\.reca-tab-phase\.tone-plan[^}]*linear-gradient/, "plan nodes need their own compact gradient tone");
assert.match(surfaces.tab, /\.reca-tab-phase\.tone-visual[^}]*linear-gradient/, "visual nodes need their own compact gradient tone");
assert.match(surfaces.tab, /\.reca-tab-phase\.failed[^}]*linear-gradient/, "failed text nodes need a failure gradient");
assert.match(surfaces.tab, /\.reca-tab-surface \.reca-tab-repair\{[^}]*linear-gradient/, "repair nodes need a distinct repair gradient");
assert.match(surfaces.tab, /\.reca-tab-surface \.reca-tab-phase\{[^}]*font:800 8\.5px/, "phase typography must override Harness button inheritance");
assert.match(surfaces.tab, /\.reca-tab-surface \.reca-tab-repair\{[^}]*font:800 8px/, "repair typography must override Harness button inheritance");
assert.match(surfaces.tab, /@keyframes reca-tab-node-pulse/, "running nodes need a restrained pulse animation");
assert.match(surfaces.tab, /animation:reca-tab-node-pulse 1\.3s ease-in-out infinite/, "running nodes need the shared pulse timing");
assert.match(surfaces.tab, /filter:saturate\(\.58\) brightness\(\.88\);opacity:\.82/, "completed nodes need a muted finish state");
assert.match(surfaces.tab, /@media\(prefers-reduced-motion:reduce\)/, "node animation must respect reduced-motion preferences");
assert.doesNotMatch(surfaces.tab, /\}\, `REPAIR \$\{/, "repair buttons must not expose verbose strategy text in the tree");

const wideShots = Array.from({ length: 12 }, (_, index) => ({
  id: `shot_${String(index + 1).padStart(2, "0")}`,
  label: `Shot ${index + 1}`,
  status: "done",
  durationS: 4,
  segments: [],
}));
const wideNodes = [
  { id: "root", kind: "root", label: "Wide tree", status: "done" },
  { id: "plan", kind: "phase", label: "Plan", status: "done" },
  { id: "assets", kind: "phase", label: "Assets", status: "done" },
  ...wideShots.map((shot) => ({ id: shot.id, kind: "shot", label: shot.label, status: shot.status, parentId: "root" })),
];
const wideSnapshot = {
  runId: "wide123456789",
  title: "Twelve-shot layout regression",
  story: "A deliberately wide tree",
  state: "succeeded",
  status: "done",
  phase: "done",
  progress: 100,
  stages: [
    { id: "plan", label: "Plan", status: "done" },
    { id: "assets", label: "Assets", status: "done" },
    { id: "render", label: "Render", status: "done" },
    { id: "validate", label: "Validate", status: "done" },
    { id: "concat", label: "Concat", status: "done" },
  ],
  assets: [],
  shots: wideShots,
  nodes: wideNodes,
  counts: { shots: 12, segments: 0, completedSegments: 0, assets: 0, repairs: 0 },
  film: { src: null, poster: null },
};
const FakeReact = {
  Fragment: Symbol("Fragment"),
  createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  useEffect() {},
  useMemo(factory) { return factory(); },
  useRef(initial) { return { current: initial }; },
  useState(initial) { return [typeof initial === "function" ? initial() : initial, () => {}]; },
};
const WideTreeView = tabSurface.createTabView({
  React: FakeReact,
  RecaTrace: {
    useSessionRunBinding() { return { runId: wideSnapshot.runId, sessionId: "session-wide" }; },
    useTraceSnapshot() { return { mode: "live", snapshot: wideSnapshot, error: null }; },
  },
});
const wideTree = WideTreeView({ useSession() {}, sessionId: "session-wide", connection: {} });

function findVNodes(value, predicate, matches = []) {
  if (Array.isArray(value)) {
    for (const child of value) findVNodes(child, predicate, matches);
    return matches;
  }
  if (!value || typeof value !== "object") return matches;
  if (predicate(value)) matches.push(value);
  findVNodes(value.children, predicate, matches);
  return matches;
}

const graphNodes = findVNodes(wideTree, (item) => item.props?.className === "reca-tab-graph");
assert.equal(graphNodes.length, 1);
assert.equal(graphNodes[0].props.style["--shot-count"], 12);
assert.equal(graphNodes[0].props.style["--reca-tab-tree-min-width"], "2276px");
const renderedShots = findVNodes(wideTree, (item) => item.props?.className === "reca-tab-shot");
assert.equal(renderedShots.length, 12);
assert.ok(renderedShots.every((item) => item.props["data-reca-parent-id"] === "root"));
assert.equal(findVNodes(wideTree, (item) => item.props?.className === "reca-tab-trunk").length, 0);
const phaseButtons = findVNodes(wideTree, (item) => String(item.props?.className || "").includes("reca-tab-phase "));
assert.deepEqual(phaseButtons.map((item) => item.children[0]), ["PLAN", "VISUAL"]);
assert.match(phaseButtons[0].props.className, /tone-plan/);
assert.match(phaseButtons[1].props.className, /tone-visual/);

const RepairTreeView = tabSurface.createTabView({
  React: FakeReact,
  RecaTrace: {
    useSessionRunBinding() { return { runId: snapshot.runId, sessionId: "session-repair" }; },
    useTraceSnapshot() { return { mode: "live", snapshot, error: null }; },
  },
});
const repairTree = RepairTreeView({ useSession() {}, sessionId: "session-repair", connection: {} });
const repairButtons = findVNodes(repairTree, (item) => String(item.props?.className || "").includes("reca-tab-repair "));
assert.equal(repairButtons.length, 1);
assert.equal(repairButtons[0].children[0], "FIX 01");
assert.match(repairButtons[0].props.className, /is-done/);

console.log("ok - UI cards stay bounded, text nodes stay compact, and wide trees retain complete root-to-shot connectors");
