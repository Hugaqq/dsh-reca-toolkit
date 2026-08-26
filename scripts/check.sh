#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -n "${PYTHON:-}" ]]; then
  RECA_PYTHON="$PYTHON"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  RECA_PYTHON="$ROOT/.venv/bin/python"
else
  RECA_PYTHON="python3"
fi
"$RECA_PYTHON" -m py_compile gateway/*.py scripts/*.py videorlm/integrations/director/*.py videorlm/framework/pipeline.py videorlm/framework/_scripts/_smoke.py
npm --prefix dsh-plugin run check
if [[ -f demo/app.js ]]; then node --check demo/app.js; fi
bash -n scripts/*.sh
git diff --check
echo "ReCA Director checks passed."
