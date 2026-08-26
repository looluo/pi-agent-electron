# 05 — Upgrade pi SDK dependencies to 0.84.3

Status: open
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
