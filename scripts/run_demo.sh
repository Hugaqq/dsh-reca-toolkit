#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BASE_URL="${RECA_GATEWAY_URL:-http://127.0.0.1:8787}"
STORY_PATH="${RECA_DEMO_STORY:-examples/sun_wukong_battle.txt}"
CURL_AUTH=()
if [[ -n "${RECA_GATEWAY_TOKEN:-}" ]]; then
  CURL_AUTH=(-H "authorization: Bearer ${RECA_GATEWAY_TOKEN}")
fi

if ! curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
  echo "Gateway is not running. Start it with: bash scripts/start-gateway.sh" >&2
  exit 1
fi

payload="$(STORY_PATH="$STORY_PATH" python3 -c 'import json, os; from pathlib import Path; p=Path(os.environ["STORY_PATH"]); print(json.dumps({"story": p.read_text(encoding="utf-8"), "options": {"backend": "wan", "resolution": "1280x720", "seed": 0, "validate": True, "validate_segments": True}}))')"
response="$(curl -fsS "${CURL_AUTH[@]}" -X POST "$BASE_URL/v1/runs" -H 'content-type: application/json' -d "$payload")"
run_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run_id"])' <<<"$response")"
echo "Started ReCA run: $run_id"

while true; do
  status="$(curl -fsS "${CURL_AUTH[@]}" "$BASE_URL/v1/runs/$run_id")"
  python3 -c 'import json,sys; d=json.load(sys.stdin); print("state={} stage={} progress={}".format(d.get("state"), d.get("stage"), d.get("progress")))' <<<"$status"
  state="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("state"))' <<<"$status")"
  case "$state" in
    succeeded|failed|cancelled) break ;;
  esac
  sleep 5
done

echo "$status"
