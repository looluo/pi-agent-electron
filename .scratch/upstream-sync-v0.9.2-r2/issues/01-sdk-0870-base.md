# Issue 01: sdk-0870-base

Type: task
Status: ready-for-agent
Blocked by: —

`da1b28b` — chore(deps): upgrade pi to 0.87.0 (#931). Gate for the whole wave:
the SDK bump re-types twelve files the other six issues build on.

Upstream adapter sweep (port each hunk; several are type-only):

- `lib/agent-event-wire.ts`, `lib/exact-system-prompt.ts`, `lib/pi-types.ts`,
  `lib/project-tree.ts`, `lib/session-list-scanner.ts`, `lib/session-reader.ts`,
  `lib/session-stats.ts`, `lib/session-title.ts`, `lib/subagent-runtime.ts`,
  `lib/rpc-manager.ts`, `components/BranchNavigator.tsx`,
  `hooks/useAgentSession.ts`

Local deltas to respect: pi-web/src/lib is shared with the Electron main
(runs in-process, ADR "lib/ (pi-web/src/lib)" in electron/AGENTS.md) — type
breaks surface at `npm run typecheck` twice (renderer + electron tsconfigs).

Gate: `npm run typecheck` clean ×2, `npm test` ≥ current baseline
(753+ suites at last count; 1 pre-existing Windows PATH failure), no behavior
change intended beyond what the adapter hunks carry.
