# 04 — Port "trim unused frontend infrastructure" + running-sessions push cleanup

Status: open
Type: task
Upstream: `602b1b6` (trim infra, incl. ProviderIcon + provider-icons.svg), `024be0b` (remove unused
running sessions SSE)

## What upstream did

Deleted `app/api/auth/all-providers`, push/unsubscribe routes; added `ProviderIcon` sprite usage;
removed the `agent/running/events` SSE route and its rpc-manager bookkeeping; ansi registry cleanups.

## Why deferred

- The deletions overlap our already-different deletions (we have no `app/` at all) — the useful
  residue is: adopt `public/provider-icons.svg` + `ProviderIcon.tsx` for provider icons, and prune
  our running-sessions push channel **if** it is unused after a usage audit.
- `024be0b` also removes subagent-runtime references we do not have yet.

## Port plan sketch

1. Audit renderer usage of `pi:agent-events` running-snapshot frames; prune if dead.
2. Copy `public/provider-icons.svg` → renderer assets and port `ProviderIcon.tsx` + ModelsConfig use.
3. Take the `lib/ansi.ts` test/behavior tweaks from `602b1b6` directly (small, isolated).
