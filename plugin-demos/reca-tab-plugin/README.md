# ReCA Conversation Tab Plugin Demo

This package adds a **ReCA** tab beside Harness's `Chat` and `Trajectory` views. The tab renders a presentation-first version of the real ReCA execution graph: shared visual state, parallel shots, serial segment leaves, validation/repair state, a node inspector, and the final video artifact.

It is an actual DeepSeek Harness rc.7 dual-face client package, not only a standalone mock:

- the host half is the light no-op `apply()` in `lib/index.js`;
- `package.json` exports `./client` and declares `dsh.client`;
- `cordis.patch.yml` mounts this package into the Web profile through `dsh.bundle.patch`;
- `lib/client.js` is a directly loadable lazy-CJS closure factory beginning with `window.__ModuleLoader__.load(...)`;
- the browser half calls `ctx.slots.inject('conversation.view', ...)` and registers the `reca` view.
- the current Session snapshot is scanned for the latest successful `reca_create_video`/`reca_start` Tool result, then the resulting `run_id` is polled through Harness's Host RPC connection every 1.6 seconds.

Polling is ordinary HTTP/RPC JSON work. It does **not** call an LLM. The shared adapter deterministically projects Gateway status, events, render-plan, audit, and artifact JSON into the UI snapshot.

The package shape follows the official rc.7 [`ui-trajectory` package](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.0-rc.7/packages/client/ui-trajectory), which is the built-in reference implementation for adding a conversation view.

## Fast standalone preview

No Harness installation is needed:

```bash
cd plugin-demos/reca-tab-plugin
npm run build
npm run demo
```

Open <http://127.0.0.1:4177/demo/>. The page draws a small Harness shell around the exact ReCA tab shape, then automatically progresses from plan to final concat. Click any segment leaf to update the inspector. The repaired leaf is in Shot 03.

Use another port if needed:

```bash
RECA_TAB_DEMO_PORT=4187 npm run demo
```

## Load into DeepSeek Harness rc.7

Build first, then add the **absolute package directory** to the Web profile:

```bash
cd plugin-demos/reca-tab-plugin
npm run build

npx @deepseek-ai/dsh@0.1.0-rc.7 plugin --profile web add "$(pwd)"
npx @deepseek-ai/dsh@0.1.0-rc.7 web
```

Open the URL printed by Harness (normally `http://127.0.0.1:3080`), create or select a session, and choose the new **ReCA** tab in the session header.

Harness's plugin manager runs `pnpm` in the profile directory. An absolute path matters: `add .` would refer to the profile itself rather than this checkout. Client package discovery happens on startup, so restart Harness after adding or rebuilding the package. If this path was already installed before a rebuild, refresh it with:

```bash
npx @deepseek-ai/dsh@0.1.0-rc.7 plugin --profile web remove dsh-reca-tab-plugin-demo
npx @deepseek-ai/dsh@0.1.0-rc.7 plugin --profile web add "$(pwd)"
```

The package does not require a Harness source checkout or a Web frontend rebuild. Its bundle is served by Harness from the package's `./client` export.

## Minimal checks

```bash
npm run check
npm pack --dry-run
```

`npm run check` rebuilds the package, checks the small set of manifest/slot contracts, and runs syntax checks on the four JavaScript entrypoints.

## File map

```text
reca-tab-plugin/
├── package.json             # dsh.bundle + dsh.client contracts
├── cordis.patch.yml         # inserts this plugin into the Web profile
├── src/
│   ├── index.js             # host no-op apply
│   ├── demo-data.json       # shared presentation data
│   ├── reca.css             # shared plugin/demo visual system
│   └── client/entry.cjs     # React view + conversation.view registration
├── scripts/build.mjs        # emits Harness lazy-CJS lib/client.js
├── lib/                     # ready-to-load package output
└── demo/                    # Harness-shaped standalone browser preview
```

## Live data behavior

When the active Session contains a ReCA Tool result, the tab labels itself **LIVE** and follows that Session's latest `run_id`. Switching Harness Sessions switches traces. The browser never connects to ReCA directly; it calls the Host's `/reca-trace` RPC service, so the Gateway may be local, remote, in a container, or behind a tunnel as long as the Host-side plugin is configured with the reachable `RECA_GATEWAY_URL`.

Without a ReCA `run_id`, the tab remains useful for presentation but labels itself **DEMO DATA**. A temporary explicit override is also available through `?reca_run_id=<id>` or `window.__RECA_RUN_ID__`.

## Intentional limitations

- The standalone preview still uses embedded presentation data; only the view loaded inside Harness has Session/Host services and therefore live polling.
- Embedded data is only a clearly marked fallback. In live mode, final and segment media URLs come from the selected Gateway run.
- This solution is a full-width conversation tab. Harness shows one conversation view at a time, so Chat and ReCA are not simultaneously visible.
- The package intentionally targets `0.1.0-rc.7`. Harness is evolving quickly; rebuild/retest the client contract before using it with another release.
- The custom builder reproduces Harness's required lazy-CJS wrapper without pulling the unpublished monorepo `clientBundle` preset. It is deliberately small and presentation-oriented.
