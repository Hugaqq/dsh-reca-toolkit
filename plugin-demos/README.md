# ReCA UI plugin lab

Three display-first DeepSeek Harness client plugin prototypes targeting
`dsh-v0.1.0-rc.7`:

- `reca-tab-plugin`: adds a `ReCA` entry to `conversation.view`.
- `reca-overlay-plugin`: adds an openable drawer to `shell.overlay`.
- `reca-details-plugin`: replaces the single `details` occupant.

## Open the demos

From the repository root:

```bash
python3 dual-replay-demo/scripts/serve.py --directory . --port 8094
```

Open `http://127.0.0.1:8094/plugin-demos/`.

Each child directory is a standalone npm package and contains its own install
notes. These are intentionally display-first prototypes: the tree uses a
source-backed sample trace, while a production integration still needs a Host
proxy and a stable live trace endpoint.
