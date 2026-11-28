#!/usr/bin/env bash
# Classify upstream-changed files for a sync: base..tip against this fork's tree.
# Usage: sync-classify.sh <base> <tip> [outfile]
set -euo pipefail
BASE="$1"; TIP="$2"; OUT="${3:-.scratch/classify.tsv}"
REPO=$(git rev-parse --show-toplevel)
cd "$REPO"

map_fork_path() {
  case "$1" in
    components/*|hooks/*|lib/*) echo "pi-web/src/$1" ;;
    app/globals.css) echo "pi-web/src/globals.css" ;;
    app/settings.css) echo "pi-web/src/settings.css" ;;
    app/sidebar.css) echo "pi-web/src/sidebar.css" ;;
    app/sidebar-menu.css) echo "pi-web/src/sidebar-menu.css" ;;
    public/provider-icons.svg) echo "pi-web/src/public/provider-icons.svg" ;;
    *) echo "" ;;
  esac
}

printf 'status\tupstream\tdir\tfork\n' > "$OUT"
git diff --name-status --no-renames "$BASE" "$TIP" | while IFS=$'\t' read -r st up; do
  fork=$(map_fork_path "$up")
  if [ -z "$fork" ]; then
    case "$up" in
      app/api/*) dir=app-api ;;
      app/*) dir=app-web ;;
      public/*) dir=public ;;
      *) dir=other ;;
    esac
    printf 'NA-%s\t%s\t%s\t\n' "$dir" "$up" "web-only" >> "$OUT"
    continue
  fi
  if [ "$st" = "D" ]; then
    if [ -e "$fork" ]; then printf 'DELETED-UPSTREAM\t%s\t%s\t%s\n' "$up" "?" "$fork" >> "$OUT"
    else printf 'NA-deleted\t%s\t%s\t\n' "$up" "web-only" >> "$OUT"; fi
    continue
  fi
  if [ ! -e "$fork" ]; then
    if git cat-file -e "$BASE:$up" 2>/dev/null; then
      printf 'FORK-ABSENT\t%s\t%s\t%s\n' "$up" "?" "$fork" >> "$OUT"
    else
      printf 'NEW\t%s\tnew\t%s\n' "$up" "$fork" >> "$OUT"
    fi
    continue
  fi
  ours=$(git hash-object "$fork")
  base=$(git rev-parse -q --verify "$BASE:$up" 2>/dev/null || echo none)
  tip=$(git rev-parse -q --verify "$TIP:$up" 2>/dev/null || echo none)
  if [ "$ours" = "$base" ]; then cls=WHOLESALE
  elif [ "$ours" = "$tip" ]; then cls=ALREADY
  elif [ "$base" = "none" ]; then cls=NEW-BOTH-DIVERGED
  else cls=THREEWAY
  fi
  printf '%s\t%s\t%s\t%s\n' "$cls" "$up" "-" "$fork" >> "$OUT"
done
cut -f1 "$OUT" | sort | uniq -c | sort -rn
