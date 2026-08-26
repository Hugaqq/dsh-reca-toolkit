# DSH ReCA Toolkit

Turn long-form stories into coherent, cinematic videos with consistent characters, scenes, and actions.

This repository packages ReCA as ReCA Director, a long-video creation Skill for DeepSeek Harness. DSH owns conversation and tool calls; ReCA remains the only owner of video planning, rendering, validation, repair, resume decisions, and artifact manifests.

## What's new in 0.4.1

- One installable `dsh-plugin/` package now contains the ReCA tree tab, live
  overlay, Host RPC bridge, media proxy, tools, and
  Director Skill; none of those runtime paths depend on `plugin-demos/`.
- Shared 1.6-second trace polling is deterministic and model-free. Gateway
  address and optional bearer token stay in the Harness Host process.
- Gateway media supports `HEAD` and single-byte `Range` requests, while Host
  and Gateway access boundaries keep private run files and tokens out of the
  browser.

- Optional first-frame and named reference-image inputs across DSH, Gateway,
  and the ReCA run configuration.
- GPT Image 2 as the default portrait, location, anchor, and repair-image
  backend, including local-reference support.
- Wan3.0 pure-R2V continuity routing compatible with the media combinations
  accepted by the deployed API.
- Bounded, retryable GPT Responses visual audits across concurrent Gateway
  processes.
- A static recorded-run Demo template built from redacted ReCA artifacts,
  without exposing provider APIs to visitors.

## ReCA visualization changes

This branch replaces the original demo-oriented visualization path with a
runtime DSH plugin backed by the active ReCA run:

- The browser binds the selected Harness session to the exact `run_id` returned
  by the ReCA tool call. Historical demo run ids are not used as fallback data.
- The Harness Host polls Gateway status and events every 1.6 seconds and shares
  one normalized trace snapshot between both UI surfaces. Polling is ordinary
  RPC/HTTP and does not invoke an LLM.
- The frontend now keeps two focused surfaces: a full ReCA execution-tree tab
  and a compact floating trace card. The redundant native Execution details
  surface and its layout dependency were removed.
- The tree renders planning, shared visual-state, shot/render, validation,
  repair, failure, and final-concat nodes with compact type aliases and distinct
  colors. Running nodes pulse; completed nodes become slightly muted; failed
  and repaired branches remain visually distinct.
- Tree cards have bounded dimensions and truncate long text instead of changing
  the graph layout. Selecting a node opens its full text, validation records,
  metadata, and image or video preview in the inspector.
- Wide trees calculate their minimum canvas width from the shot count, so the
  root-to-shot connectors remain continuous when the graph grows horizontally.
- Typography and secondary labels use higher-contrast colors for the pure-black
  graph background while preserving pending, running, completed, and failed
  state hierarchy.
- The Host owns Gateway URL, token, media proxying, and run-instance checks.
  Consequently the same plugin supports a local Gateway, a remote HTTPS
  Gateway, or a Gateway reached through an SSH tunnel without exposing backend
  credentials or deployment topology to browser code.

## Runtime shape

```text
DSH Web → ReCA Director Skill → ReCA Gateway → ReCA child process → final.mp4 + audit + manifest
    │                                  ▲
    └─ ReCA tab / overlay ─────────── Host `/reca-trace` polling bridge
```

The gateway exposes asynchronous task lifecycle endpoints:

```text
POST /v1/runs
GET  /v1/runs/{run_id}
GET  /v1/runs/{run_id}/events
POST /v1/runs/{run_id}/cancel
POST /v1/runs/{run_id}/resume
GET  /v1/runs
GET  /v1/runs/{run_id}/artifacts
GET  /v1/capabilities
```

The single `dsh-plugin/` package registers `reca_create_video`,
`reca_get_capabilities`, `reca_get_status`, `reca_cancel`, `reca_resume`,
`reca_list_runs`, and `reca_get_artifact`. Compatibility aliases `reca_start` and `reca_status`
remain available. Its browser half also installs the full ReCA tree tab and the
compact overlay. Those two surfaces
share one model-free polling store: they bind to the exact `run_id` returned in
the current Harness conversation and call the Host-owned `/reca-trace` RPC.
The legacy `plugin-demos/` packages are reference implementations only and are
not runtime dependencies.

The plugin never receives provider credentials; ReCA reads them from the
ignored local `.env` file or the process environment. The browser also never
receives the ReCA deployment address. `RECA_GATEWAY_URL` is resolved by the
Harness Host, so it may point to a co-located Gateway, a remote HTTPS endpoint,
or an SSH tunnel local to the Host.

## Local setup

```bash
bash scripts/install.sh
# Fill the provider values in .env
bash scripts/doctor.sh
bash scripts/start-gateway.sh
```

These scripts prefer the repository's `.venv/bin/python` so the Gateway,
doctor, and worker capability checks use the same installed dependencies.
Set `PYTHON=/path/to/python` only when intentionally using another environment.

In another terminal, install the local plugin into the DSH web profile and start DSH:

```bash
export RECA_GATEWAY_URL=http://127.0.0.1:8787
# Recommended when the Gateway is reachable over a network:
export RECA_GATEWAY_TOKEN='<host-to-gateway token>'
bash scripts/install_dsh_plugin.sh
dsh web
# If dsh is not installed on PATH, use: npm exec @deepseek-ai/dsh -- web
```

The installer supports both a PATH-installed `dsh` and `npm exec`. It verifies
the installed runtime files and, when pnpm retained a stale same-version
`file:` snapshot, refreshes only `dsh-reca-toolkit` by removing and re-adding
that profile dependency. Restart the DSH Host after it finishes.

If ReCA runs elsewhere, replace `RECA_GATEWAY_URL` with the address reachable
from the Harness Host. Browser-side `127.0.0.1` is never used for Gateway
discovery. Polling itself is plain RPC/HTTP and does not consume LLM tokens;
only ReCA planning, validation, or the normal Harness conversation may invoke
models.

`reca_get_capabilities` is a read-only configuration/runtime check. It lets the
conversation model distinguish an internal ReCA image backend from a visible
DSH tool and reports backend registration, credential presence, and local
runtime readiness separately. It also resolves the effective portrait,
anchor-image, and image-edit routes after their per-kind overrides. It never
sends a provider request and never returns credential values;
`network_checked=false` means upstream reachability remains unknown. In
particular, GPT Image 2 is an internal image renderer selected by
`RECA_IMAGE_BACKEND` or a per-kind route; it is not expected to appear as a
standalone DSH generation tool.

The Gateway persists an opaque identity as `.gateway-instance-id` inside its
run store. The browser binding includes that identity with the Harness session,
run id, and source tool sequence, so a remote run id cannot silently be polled
against a different local Gateway. Set `RECA_GATEWAY_INSTANCE_ID` only when the
run store cannot persist this private `0600` marker.

The Host attaches `RECA_GATEWAY_TOKEN` to lifecycle, trace, and media requests;
the value never enters the browser bundle. Gateway browser CORS is disabled by
default, and POST requests require JSON. Leave `RECA_TRACE_AUTHORITY` at its
default `loopback` for local/SSH-tunneled Harness. Set it to `trusted-host` only
when Harness Connection has an explicit trusted-host allowlist for the public
Web origin. That allowlist is a shared Host trust boundary rather than
per-user/run authorization; mutually untrusted tenants need separate
Harness/Gateway instances or an identity-aware proxy with a run-ownership
policy.

For the DSH conversation model, copy
[`configs/dsh-settings.example.yaml`](configs/dsh-settings.example.yaml) to
`$DSH_HOME/settings.yaml`, then export `RECA_DSH_DEEPSEEK_API_KEY` in the DSH
process environment. The example uses DSH's `llm-pi-ai` OpenAI-compatible route
because the team gateway supports `/v1/chat/completions`; ReCA's own planner
continues to use its separate Messages adapter.

The gateway can also be exercised without DSH:

```bash
bash scripts/run_demo.sh
```

The demo submits [`examples/sun_wukong_battle.txt`](examples/sun_wukong_battle.txt) by default, polls the task, and reports the final artifact URL. Set `RECA_DEMO_STORY=examples/story.txt` to use the shorter generic story. Generated files are stored under `.dsh_runs/`, which is ignored by git.

The Director request supports `story`, `duration`, `resolution`, `style`,
`aspect_ratio`, `backend`, `enable_audit`, and `seed`. It also accepts optional
`first_frame` and `reference_images` inputs. A first frame replaces the
automatically generated anchor for the first shot; reference images are passed
to anchor planning and are forwarded to segment rendering when the selected
video backend supports reference media. Server-side image paths are a trusted
Gateway-operator capability because the Gateway reads and stages those files;
do not expose that input mode to untrusted tool callers. Wan3.0 preserves
ReCA's planner and serial segment chain while adapting only the provider
mapping: I2V sends the current frame as its sole reference; R2V sends the
current frame as
`reference_image[0]`, followed by up to three planner-selected identity, scene,
or prop references. The R2V prefix explicitly asks Wan3.0 to begin from the
first reference. Bridges continue to use the provider's real first/last-frame
pair. This is a soft start constraint because Wan3.0 does not expose a hard
first-frame slot that can be combined with additional reference images. ReCA emits separate
Gateway, ReCA, video, and audit states. A generated video may legitimately
return `audit_skipped` or `audit_failed`.

## Recorded replay demo

The `demo/` directory is a static playback surface, not a public generation
endpoint. Build it from a completed real run:

```bash
python3 scripts/build_replay_manifest.py .dsh_runs/<run_id>
python3 scripts/build_demo_bundle.py .dsh_runs/<run_id>
python3 -m http.server 8080 --directory demo
```

The replay manifest is derived from the real request, planner, render plan,
audit, events, and artifact manifest. Generated media and run-specific replay
data remain ignored by Git; publish the resulting bundle through object storage
or a dedicated Demo deployment. `scripts/generate_first_frames.py` and
`scripts/monitor_batch.py` are optional helpers for preparing and monitoring a
curated multi-run Demo batch; provider credentials still come only from the
process environment.

For a direct ReCA run without DSH, use the bundled entry point:

```bash
python3 -m videorlm.framework._scripts._smoke \
  --story examples/story.txt --segments --render --backend wan \
  --video-resolution 1280x720
```

## Provider configuration

Only configuration is expected to change for the team-specific APIs. DeepSeek planner calls use the existing Claude Messages adapter, GPT internal visual validation uses the bundled Responses adapter, and the Wan 3.0 backend uses Alibaba Model Studio's async task API with temporary OSS staging for local references. The public source contains no provider credentials.

Never commit `.env`, API keys, generated videos, run-specific replay data, or
run logs.
