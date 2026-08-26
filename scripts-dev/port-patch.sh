#!/usr/bin/env bash
# Port an upstream pi-web commit's renderer files into pi-web/src/.
# Usage: port-patch.sh <sha> [paths...]   (default: components hooks lib)
set -euo pipefail
sha="$1"; shift
cd "$(dirname "$0")/.."
tmp=".scratch/port-${sha}.patch"
if [ $# -gt 0 ]; then
  git show "$sha" -- "$@" > "$tmp"
else
  git show "$sha" -- components hooks lib > "$tmp"
fi
if out=$(git apply --3way --directory=pi-web/src "$tmp" 2>&1); then
  echo "OK $sha"
else
  echo "CONFLICT $sha:"; echo "$out"
  git status --short | grep -E '^(AA|UU|DD|AU|UA|DU|UD)' || true
fi
