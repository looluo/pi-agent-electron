# 05 — Upgrade pi SDK dependencies to 0.84.3

Status: resolved
Type: task
Upstream: `55164b5` (chore: upgrade pi dependencies to 0.84.3)

## What upstream did

Bumped `@earendil-works/pi-*` from 0.84.2 → 0.84.3 (plus a SettingsUi test tweak riding along).

## Why deferred

We pin `@earendil-works/pi-agent-core|pi-ai|pi-coding-agent|pi-tui` at `0.84.2`
(`package.json`). None of the v0.8.9→v0.8.11 commits ported so far require 0.84.3 APIs. The
subagents cluster (issue 01) does — its restore/relation fixes chase 0.84.3 behavior.

## Port plan sketch

1. Bump the four deps to `0.84.3`, `npm install`.
2. `npm run typecheck && npm test && npm run test:e2e` — full gate.
3. Record in `docs/upstream-sync.md` when done; then issue 01 unblocks.

## Answer

Done on branch `sync/pi-web-v0.8.11`. Pinned all four `@earendil-works/pi-*` deps to exactly
`0.84.3` (matching upstream v0.8.11's `package.json`; 0.84.3 is also the latest published). No
source changes required:

- The only 0.84.3 breaking change (rename `GoogleThinkingLevel` → `GoogleApiThinkingLevel`) is
  unreferenced in this repo (grep clean over `pi-web/src` + `electron`).
- New 0.84.3 surfaces we care about later: optional `powershell` tool (needed by deferred issue 02,
  upstream `081c5b1`), `session_compact_failed` extension events, compaction-summary routing
  session ids. None are used by current code; they only widen what issues 01–02 can build on.

Verification: `npm run typecheck` clean; `npm test` 643/645 (1 pre-existing Windows PATH-separator
failure, 1 skipped — identical to pre-upgrade baseline); `npm run test:e2e` 7/7. Issue 01
(built-in subagents) is now unblocked.
