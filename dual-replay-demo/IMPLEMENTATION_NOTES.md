# Dual replay implementation notes

## Isolation and rollback

- Remote output: `/mnt/cpfs02/akide/us/haoming/dsh-reca-dual-replay-gallery`
- Source run: `/mnt/cpfs02/akide/us/haoming/dsh-reca-toolkit-dev/.dsh_runs/nezha_fire_pagoda`
- Existing `demo`, `demo-2`, ReCA source, run artifacts, and repository files were
  treated as read-only.
- Rollback is isolated: stop the preview process and archive or remove only the
  new remote output directory. No existing checkout needs a Git reset.

## New files and responsibilities

| File | Original state | New behavior |
|---|---|---|
| `index.html` | Did not exist | Dual-view DSH session replay and ReCA tree shell |
| `styles.css` | Did not exist | Responsive dark UI, tree dependencies, run states, inspector and final player |
| `app.js` | Did not exist | Shared replay clock, DSH tape, tree state machine, scrub/speed controls and node inspector |
| `scripts/build_trace_manifest.py` | Did not exist | Redacted v3 trace generated from real persisted run artifacts and runtime logs |
| `scripts/build_demo_bundle.py` | Did not exist | Copies only referenced local images/videos into the static bundle |
| `scripts/verify_bundle.py` | Did not exist | Checks schema, event coverage, media references, repairs and redaction invariants |
| `scripts/serve.py` | Did not exist | Static HTTP server with byte-range support for MP4 seeking |

## Real artifact mapping

| Run artifact | Replay use |
|---|---|
| `request.json` | User-visible story and safe run options |
| `skeleton.json` | Shots, transitions and story states |
| `render_plan.json` | Segment dependency, prompts, anchors and shared assets |
| `events.jsonl` | Actual segment completion, validation, reroll and micro-adjust order |
| `run/reca_state.json` | Terminal state and counts |
| `run/audit.json` | Audit state |
| `run/summary.json` | Timings and backend names |
| `run/anchors`, `portraits`, `locations`, `props` | State-memory and anchor previews |
| `run/segments` | Leaf video and tail-frame previews |
| `run/final.mp4` | Root output |

Provider URLs, absolute server paths, environment variables, configuration
files, credentials, and raw backend request payloads are not included in the
generated manifest.

## Verified bundle snapshot

- Run: `nezha_fire_pagoda`
- Trace schema: v3
- Shots: 3
- Canonical segments: 8
- Shared/anchor images: 6
- Repaired leaves: 3
- Normalized replay events: 52
- Referenced media files: 24
- Final video: 149,614,517 bytes
- Preview endpoint: loopback port 8091

## Multi-case gallery adaptation

- Visual tokens now match the original `demo-2`: `#0c0d0f` background,
  `#f4f1ea` ink, `#9a958b` muted text, `#2a2c31` rules, and `#d4a25a` gold.
- The gallery is driven by `data/index.json` and namespaced case manifests.
- Cases: Flower-Fruit Oath, Grand Piano, Reed Marsh, and Nezha Fire Pagoda.
- A case switch replaces the complete tree, DSH tape, state memory, Segment
  media, validator events, and final film—not just the final video element.
- Runs without retained Gateway JSONL fall back to renderer logs, then to
  artifact-derived ordering. The manifest records which evidence source was
  available.
- Deployment remains loopback-only with SSH forwarding. Cloudflare deployment
  is explicitly out of scope.

## Homepage and replay routing

- `/index.html` is a product homepage based on the original showcase's visual
  language and non-gallery content.
- The old Session and Films presentation sections are intentionally omitted
  from the homepage.
- `/replay/index.html` is the four-case interactive execution appendix.
- The replay page uses a base path back to the shared root bundle, so the four
  manifests and namespaced media remain single-source.
- Homepage hero video is hard-linked from the completed
  `wukong_huaguo_oath/run/final.mp4`; the run artifact is not modified.
- The replay's Harness pane follows the official open-source Web shell rather
  than copying the product: a 56px rail, session header, conversation and
  trajectory tabs, right-aligned user bubble, collapsed Think disclosure,
  recursive tool rows with IN/OUT, and a read-only composer.

## 2026-08-24 Harness presentation update

| Location | Before | After |
|---|---|---|
| `home-assets/hero.mp4` | Original showcase preview media | Hard link to `assets/runs/flower-fruit-oath/final.mp4` (`wukong_huaguo_oath`, 90.2s) |
| `replay/index.html` intro | Explanatory paragraph beginning with `左侧是 DSH` | Paragraph removed |
| Harness pane | Flat tape mixing chat and ReCA log lines | 56px rail plus separate conversation and trajectory tabs |
| Agent messages | Identical boxed cards for user and assistant | Right-aligned user bubble, unboxed assistant response and collapsed Think disclosure |
| Tool calls | Standalone bordered card | Recursive summary row, optional IN/OUT body and trajectory child link |
| Replay URL | Fragment resolved against `<base>` and could become `/#case` | Explicitly remains `/replay/#case` |

The reconstruction was derived from the official `ui-layout`, `ui-sidebar`,
`ui-conversation`, `ui-tool`, and `ui-theme` packages in
<https://github.com/deepseek-ai/deepseek-harness>. It reproduces selected
interaction and hierarchy cues for exhibition, not the proprietary identity
assets or a live Harness client.

## 2026-08-24 homepage integration and progressive tree

| Location | Before | After |
|---|---|---|
| Homepage film entry | Link to a separate Replay appendix | Embedded synchronized workbench in the original Films position |
| Replay initial state | Playback began immediately and the entire pending tree was visible | Playback starts paused with ROOT only |
| Plan event | Changed pre-rendered Shot colors | Reveals the parallel Shot branches and trunk |
| Asset/Anchor/Segment events | Changed opacity or status on visible nodes | Insert visually through `unborn` → active growth transitions |
| Repair event | Changed the Segment color | Reveals a child repair branch and marks it accepted on completion |
| Final film | Author CSS overrode the HTML `hidden` attribute | `.finale[hidden]` stays hidden until `reca.final.ready` |
| Harness identity | Letter `D` placeholder | Official whale mark reused from the DeepSeek Harness open-source Web asset |
| Explanatory copy | Included two development-oriented Chinese paragraphs | Both paragraphs removed |

The standalone `/replay/` files remain only as the internal iframe source and
for backward-compatible direct links. Main navigation and calls to action now
target `/#films`.
