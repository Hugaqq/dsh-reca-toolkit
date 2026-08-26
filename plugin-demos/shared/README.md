# Shared ReCA trace polling layer

`trace-adapter.cjs` and `trace-react.cjs` are the model-free data layer shared by
the Tab, Overlay, and Details clients. Polling does **not** call an LLM: it
performs ordinary RPC/HTTP requests and deterministically maps persisted ReCA
state into a UI snapshot. ReCA itself may use models while planning, rendering,
or validating; the viewer does not.

## Deployment boundary

The browser never receives or calls `RECA_GATEWAY_URL`. The existing
`dsh-reca-toolkit` Host plugin owns one `/reca-trace` Connection RPC channel and
one `/reca-media` artifact proxy. The three browser surfaces call the same Host
channel, so their code is identical when ReCA is:

- on the same machine as Harness Host (`http://127.0.0.1:8787`);
- on a different server reachable by Harness Host;
- behind an SSH tunnel terminating on the Harness Host machine.

Configure the Host side with `RECA_GATEWAY_URL` or the plugin's `gatewayUrl`.
Do not put a remote Gateway URL or credential into a browser global.

## Real inputs

Each refresh reads:

- `GET /v1/runs/:run_id` — authoritative lifecycle and `reca_state`.
- `GET /v1/runs/:run_id/events` — the Gateway's rolling 200-log window.
- `GET /v1/runs/:run_id/artifacts` — published final/inspection artifacts.
- `GET /v1/runs/:run_id/artifacts/render_plan.json` — real shots, anchors, and
  segments; fetched opportunistically even while the manifest still says
  `missing`.
- `GET /v1/runs/:run_id/artifacts/run/audit.json` — audit state.
- `GET /v1/runs/:run_id/artifacts/request.json` — safe request/story, used only
  for display text.

The active-run manifest is not sufficient by itself. It is written at run start
and terminal state, while `render_plan.json` appears between those points. The
adapter therefore tolerates 404 for optional artifacts and keeps the last valid
copy. It also accumulates event windows so an earlier completed segment does not
disappear when it rolls out of the latest 200 lines.

## Client lifecycle

The React helper scans the current session's `reca_create_video` tool result,
extracts its exact `run_id`, and polls the Host RPC every 1.6 seconds. All three
surfaces share one browser store per `run_id`, so enabling Tab, Overlay, and
Details does not triple the Gateway traffic. A terminal run stops polling.

Bind the exact `run_id` returned by `reca_create_video`; do not silently pick the
latest global run because it may belong to another Harness conversation.

The normalized snapshot exposes:

- `runId`, `title`, `state`, `status`, `phase`, `progress`, and `terminal`;
- five presentation stages (`plan/assets/render/validate/concat`);
- `assets`, nested `shots[].segments[]`, and one flat `nodes[]` tree;
- validation scores and explicit repair child nodes parsed from real events;
- Gateway-rebased asset, anchor, segment, poster, and final-video URLs;
- `counts`, `auditState`, `videoState`, `artifacts`, and recent events.

`publicArtifactUrl()` rewrites remote absolute paths and the Gateway's internal
`127.0.0.1` URLs through the same-origin `/reca-media` Host proxy.

## Lightweight check

```bash
node plugin-demos/shared/check.mjs
```

The fixture mirrors the observed field shapes of server run `190160905a09`; it
contains no credentials and no generated media.
