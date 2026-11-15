#!/usr/bin/env bash
# Apply a sync-classify.tsv: wholesale/new taken from tip, three-ways merged
# in place (conflict markers left for manual resolution).
# Usage: sync-apply.sh <base> <tip> <classify.tsv> [apply.log]
set -euo pipefail
BASE="$1"; TIP="$2"; TSV="$3"; LOG="${4:-.scratch/apply.log}"
REPO=$(git rev-parse --show-toplevel); cd "$REPO"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
: > "$LOG"
conflicted=0
while IFS=$'\t' read -r cls up _ fork; do
  case "$cls" in WHOLESALE|NEW|THREEWAY) ;; *) continue ;; esac
  tab=$'\t'
  if grep -qE "^(MERGED-CLEAN|CONFLICTED|WHOLESALE|NEW|SKIPPED-NO-BASE)${tab}${up}(${tab}|\$)" "$LOG" 2>/dev/null; then continue; fi
  if [ "$cls" = THREEWAY ] && ! git cat-file -e "$BASE:$up" 2>/dev/null; then
    echo "SKIPPED-NO-BASE${tab}${up}${tab}THREEWAY without base; classify bug" >> "$LOG"; continue
  fi
  mkdir -p "$(dirname "$fork")"
  git show "$TIP:$up" > "$TMP/theirs"
  if [ "$cls" = "THREEWAY" ]; then
    git show "$BASE:$up" > "$TMP/base"
    cp "$fork" "$TMP/ours"
    if git merge-file -L ours -L base -L theirs "$TMP/ours" "$TMP/base" "$TMP/theirs"; then
      cp "$TMP/ours" "$fork"; echo "MERGED-CLEAN	$up" >> "$LOG"
    else
      cp "$TMP/ours" "$fork"
      echo "CONFLICTED	$up	$(grep -c '^<<<<<<<' "$fork") hunks" >> "$LOG"
      conflicted=$((conflicted+1))
    fi
  else
    cp "$TMP/theirs" "$fork"; echo "$cls	$up" >> "$LOG"
  fi
done < "$TSV"
sort "$LOG" -o "$LOG"
echo "conflicted files: $conflicted (see $LOG)"
