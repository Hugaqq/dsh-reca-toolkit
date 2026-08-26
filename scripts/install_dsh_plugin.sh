#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v dsh >/dev/null 2>&1; then
  DSH_COMMAND=(dsh)
elif command -v npm >/dev/null 2>&1; then
  DSH_COMMAND=(npm exec --yes @deepseek-ai/dsh --)
else
  echo "Neither dsh nor npm is available; install @deepseek-ai/dsh first" >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || {
  echo "node is required to verify the installed DSH plugin" >&2
  exit 1
}

PLUGIN_SPEC="file:$ROOT/dsh-plugin"
"${DSH_COMMAND[@]}" plugin --profile web add "$PLUGIN_SPEC"

if ! node "$ROOT/dsh-plugin/scripts/check-installed.mjs"; then
  echo "The existing file: package snapshot is stale; refreshing dsh-reca-toolkit..." >&2
  "${DSH_COMMAND[@]}" plugin --profile web remove dsh-reca-toolkit
  "${DSH_COMMAND[@]}" plugin --profile web add "$PLUGIN_SPEC"
  node "$ROOT/dsh-plugin/scripts/check-installed.mjs"
fi

echo "dsh-reca-toolkit is installed in the web profile; restart the DSH Host to load it."
