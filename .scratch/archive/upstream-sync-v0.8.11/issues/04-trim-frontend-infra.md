# 04 — Port "trim unused frontend infrastructure" + running-sessions push cleanup

Status: resolved
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

## Answer

Done on branch `sync/pi-web-v0.8.11` (after 05 + 01 + 02 + 03). All three plan items:

1. **Running-push audit**: `pi:agent:running` (invoke, polled by SessionSidebar) is alive and kept;
   the broadcaster it never fed (`subscribeRunningSessions`/`notifyRunningChange`, whose only
   upstream consumer was the SSE route we never had) is dead code and now deleted along with
   `RUNNING_STATE_EVENT_TYPES` and the `withFinalRunningNotification`→`withFinalIdleReset` rename
   (upstream 024be0b).
2. **rpc-manager realigned to 28bab3c**: this also picked up the 081c5b1 hunks that the issue-02
   port had missed (PowerShell in CODING_TOOL_NAMES, `resolveShellTools` in withExtensionTools,
   tool-selection restore across reload). Widget-test fixtures updated to upstream's
   (getActiveToolNames/getAllTools/setActiveToolsByName + getDefaultTools). This was a real
   functional gap: without it the PowerShell settings toggle changed nothing at runtime.
3. **ansi residue (602b1b6)**: ExtensionStatusBar status line and the ChatWindow custom panel now
   render through `AnsiText` (ansi_up); the hand-rolled SGR/256-color parser (parseAnsiLine,
   ansi256Color, ANSI_*_COLORS, AnsiSegment) deleted from lib/ansi.ts (now only stripAnsi +
   normalizeCustomPanelLines); ansi.test.mjs at upstream 28bab3c; ExtensionStatusBar test
   assertion updated to the AnsiText markup.

web-push strip re-applied on the realigned rpc-manager (import + onAgentRunComplete call site).

Verification: typecheck clean; `npm test` 743 (741 pass, 1 skip, 1 pre-existing Windows PATH
failure); `npm run test:e2e` 7/7. Issue tracker for this sync is now fully resolved (05→01→02→03→04).
