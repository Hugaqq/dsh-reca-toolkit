# dsh-reca-toolkit

One DeepSeek Harness package that combines the ReCA Host integration and two
focused browser visualizations:

- `conversation.view`: full ReCA execution-tree tab;
- `shell.overlay`: compact live execution drawer.

The full tab and compact card each provide their own node inspection, including
text detail and image/video preview. The redundant native `details` takeover is
intentionally not registered.

The browser never connects to ReCA directly. It binds the current Harness
conversation to the exact `run_id` returned by `reca_create_video`,
`reca_create_video_interactive`, or `reca_start`, then polls the Host-owned
`/reca-trace` RPC every 1.6 seconds.
This polling and trace normalization are deterministic and do not call an LLM.

`reca_create_video_interactive` uses Harness's native `ctx.userQuestions`
channel. It may ask one batch of up to three material preference questions,
then presents a Creative Brief through the native `plan-review` intent. No
Gateway run exists before explicit approval. Returning the brief for revision,
dismissing the review, aborting the turn, calling from a live child agent, or
running without a UI provider never falls back to automatic submission.

The Host plugin also exposes `reca_get_capabilities`. This read-only tool tells
the conversation model which internal image backend the connected Gateway has
selected and whether it is registered, credentialed, and locally importable.
It does not call GPT Image 2 or any other provider.

## Install and run

Start a ReCA Gateway on the machine reachable by the Harness Host:

```bash
cd /path/to/dsh-reca-toolkit
bash scripts/start-gateway.sh
```

Then install this one package and start Harness:

```bash
export RECA_GATEWAY_URL=http://127.0.0.1:8787
# For a protected or remote Gateway, export the same token on both processes.
export RECA_GATEWAY_TOKEN='<host-to-gateway token>'
bash scripts/install_dsh_plugin.sh
dsh web
# If dsh is not installed on PATH, use: npm exec @deepseek-ai/dsh -- web
```

Run the installer again after updating this source directory, then restart the
DSH Host. It supports both a PATH-installed `dsh` and `npm exec`, verifies the
installed runtime files, and refreshes only `dsh-reca-toolkit` when pnpm retained
a stale same-version `file:` snapshot. Rebuilding the browser bundle alone does
not refresh an installed file list.

Verify the default Web profile after reinstalling:

```bash
npm run check:installed
```

Set `DSH_PROFILE_DIR` when using a non-default profile directory.

`RECA_GATEWAY_URL` belongs to the Host process. It can point to a co-located
Gateway, a remote HTTPS Gateway, or a local port created by an SSH tunnel. Do
not set it to a browser-side `127.0.0.1` unless the Gateway actually runs on the
same machine as the Harness Host.

`RECA_GATEWAY_TOKEN` is attached only by the Host client, including proxied
media requests. Provider credentials also remain on the Gateway/Host side. No
token, API key, or ReCA service address is shipped in `lib/client.js`.

The trace and media routes are loopback-only by default. For a Harness Web
instance intentionally served from a configured trusted host, set
`RECA_TRACE_AUTHORITY=trusted-host` in the Host process and configure the same
host in Harness Connection's trusted-host list. The media and RPC routes use
the same authority fence.

`trusted-host` is one shared Host trust domain, not per-conversation or
per-user authorization: an accepted browser that knows another run ID can ask
the same Host for that run's published trace/media. Do not share one instance
between mutually untrusted tenants; isolate their Harness Hosts/Gateways or put
an identity-aware proxy and run-ownership policy in front of them.

The Gateway itself binds to `127.0.0.1` by default, requires JSON for all
state-changing requests, and does not enable browser CORS. Keep
`RECA_GATEWAY_ALLOW_ORIGIN` empty for the normal Host-proxy architecture.

## Verify the package

```bash
cd dsh-plugin
npm run check
```

The checked-in `lib/client.js` is generated entirely from files inside this
package. The legacy `plugin-demos/` directory is only a visual reference and is
not a runtime dependency.
