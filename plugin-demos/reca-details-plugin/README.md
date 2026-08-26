# ReCA Details takeover plugin demo

This display-first package registers a ReCA execution panel into Harness's
session-scoped, single-occupant `details` slot. The panel participates in the
real AppFrame column sizing, so the native conversation genuinely narrows.

The trade-off is intentional: this variant replaces Harness's native tool
Details occupant. It is a prototype for comparing layout quality, not the
recommended coexistence strategy.

## Build and inspect

```bash
cd plugin-demos/reca-details-plugin
npm run check
```

Open the standalone demo from the repository-wide lab server:

```bash
python3 dual-replay-demo/scripts/serve.py --directory . --port 8094
```

Then visit `http://127.0.0.1:8094/plugin-demos/reca-details-plugin/demo/`.

## Install into Harness rc.7

```bash
dsh plugin --profile web add ./plugin-demos/reca-details-plugin
dsh web
```

`cordis.patch.yml` mounts the plugin row, while the package manifest declares
the Web half plus its `connection` and `ui-layout` dependencies.

## Real trace behavior

The component reads only the current Harness session snapshot. It finds the
exact `run_id` returned by that session's successful `reca_create_video` or
`reca_start` tool result, then polls the Host-side `/reca-trace` RPC every 1.6
seconds. The shared deterministic adapter maps Gateway state, real
`render_plan.json`, events, audits, and artifacts into the panel's stages,
progress, tree, inspector media, and counts. This viewer polling performs no
LLM calls.

Until the current session contains a ReCA `run_id`, the embedded showcase stays
visible with an explicit `DEMO TRACE` / `DEMO · no session run` label. A failed
refresh keeps the last useful snapshot and marks the panel stale or unavailable.
