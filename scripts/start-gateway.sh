#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -n "${PYTHON:-}" ]]; then
  RECA_PYTHON="$PYTHON"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  RECA_PYTHON="$ROOT/.venv/bin/python"
else
  RECA_PYTHON="python3"
fi
exec "$RECA_PYTHON" -m gateway.server "$@"
