#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example; fill provider credentials before running."
fi
if [[ -n "${PYTHON:-}" ]]; then
  RECA_PYTHON="$PYTHON"
else
  if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
    python3 -m venv "$ROOT/.venv"
  fi
  RECA_PYTHON="$ROOT/.venv/bin/python"
fi
"$RECA_PYTHON" -m pip install -r requirements.txt
echo "ReCA Director dependencies installed."
