# DSH × ReCA dual replay

This static page replays completed DSH + ReCA jobs from their real persisted
artifacts. It does not call a model provider or expose provider URLs. The case
picker is declared in `data/index.json`; each case owns a namespaced manifest
and media directory.

Routes:

- `/` — product overview with the synchronized film, DSH conversation and ReCA
  execution tree embedded directly in the original Films position.
- `/replay/` — the same replay surface retained as an internal embeddable route;
  the homepage no longer sends visitors to a separate appendix.

## Build a bundle

```bash
python3 scripts/build_demo_bundle.py \
  /path/to/dsh-reca-toolkit/.dsh_runs/<run_id> \
  --output . \
  --slug <case-slug> \
  --link
```

The builder reads `request.json` or `story.txt`, `skeleton.json`, `render_plan.json`,
`events.jsonl`, `run/reca_state.json`, `run/audit.json`, `run/summary.json`, and
local media. If Gateway events were not retained, it falls back to `run.log`;
if neither exists, the tree still comes from persisted plans and media. It
writes `data/runs/<case-slug>.json` and copies or hard-links only referenced
media into `assets/runs/<case-slug>/`.

## Preview

```bash
python3 scripts/serve.py --directory . --port 8091
```

The bundled server supports HTTP byte ranges, so the final film and individual
segments can seek without downloading every MP4 from the beginning.

For the current remote preview, keep this command running in a local terminal:

```bash
ssh -NT -L 18091:127.0.0.1:8091 wan-dev-node-02-H100-haoming
```

Then open `http://127.0.0.1:18091/`. Use the homepage CTA to enter
`http://127.0.0.1:18091/replay/`.

This project is deliberately server-local. Do not deploy it through Cloudflare
Pages, Workers, Tunnel, or any other public hosting path.

The replay clock is intentionally compact. Event order and repair decisions
come from the real run; long provider wait times are not reproduced.

The homepage hero uses the completed `wukong_huaguo_oath/run/final.mp4` film.
The replay's left pane is an exhibition reconstruction informed by the official
DeepSeek Harness open-source Web components; it is not an embedded live DSH
client. It mirrors the 56px sidebar rail, conversation/trajectory tabs, user
bubble, Think disclosure, recursive tool rows, IN/OUT detail and composer.

The embedded replay starts paused. ROOT is the only visible tree node at reset;
Shot branches appear when planning completes, memory and anchors appear on their
ready events, Segment leaves appear on render start, and repair attempts grow as
child branches. The final player remains hidden until `reca.final.ready`.
