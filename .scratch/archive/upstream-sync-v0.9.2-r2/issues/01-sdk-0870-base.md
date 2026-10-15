# Issue 01: sdk-0870-base

Type: task
Status: resolved
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

## Answer

Resolved. `da1b28b` ported via port-patch + `piweb` remote fetch for real 3-way
blobs (remote now added; use it for the rest of the wave). 18 files clean, 4
conflicts resolved by hand:

- `session-title{.ts,.test.mjs}` kept at pre-#807 (da1b28b's hunks target the
  #807 implementation; issue 02's territory). Old shadow-agent tests adapted to
  the 0.87 provider context (leading `system` role message: 3 role-array + 2
  index assertions).
- `rpc-manager.test.mjs` EOF block: kept 3 new tests (exact prompts via
  before_agent_start, persisted tool selection at startup, chat-only boundary
  rebuild), dropped 5 that duplicate locally-adapted versions reading electron
  service sources; local "reloading invalidates models cache" re-asserted
  against the post-exact-prompt reload shape.

Pulled forward from issue 06: `50a2fd4`'s `lib/session-reader.ts` +
`session-reader.pagination.test.mjs` — da1b28b's new hides-transcript-system-
messages test depends on `countsTowardTail`. Two local-divergence adaptations
recorded: anchor rollback (26be91e) extends the initial window to the turn
anchor past the #810 budget (test updated to local shape + tail:1 assert);
the 2500-entry cap test now expects the visible-count window (e2481 head,
10 assistant + interleaved toolResults).

Gate: typecheck ×2 clean; `npm test` 975/979 (1 pre-existing Windows PATH
baseline); `npm run test:e2e` 8 passed 1 skipped (baseline); no
`applyExactSystemPrompt`/`prepareNextTurnWithContext`/`state.systemPrompt =`
residue in electron/ or pi-web/src.
