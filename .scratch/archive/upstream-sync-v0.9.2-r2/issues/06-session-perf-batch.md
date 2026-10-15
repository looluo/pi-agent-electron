# Issue 06: session-perf-batch

Type: task
Status: resolved
Blocked by: 01, 05

Largest cluster; serialized after issue 05 because `234e19e` reshapes the
same `hooks/useAgentSession.ts` / `lib/session-reader.ts` regions as the
chat-ui commits — landing 05 first shrinks the conflict surface.

- `234e19e` — perf(session): #928 + #912 rebased (#940). 1533-line cluster:
  new `lib/session-view-cache.ts` (view-level memo keyed on session
  revision) + `lib/session-revision.ts` (cheap external-change detection),
  plus session-reader / session-list-scanner / project-tree / worktree /
  AppShell / SessionSearch / SessionSidebar / hook / `app/api/sessions*`
  routes. Re-home the three route changes onto `sessionsGet` /
  `sessionsContext` / `sessionsList` / session-search IPC as applicable.
  Verify our `tail`/`before` pagination semantics survive the view-cache
  keys (upstream pagination predates the cache — check cache busting on
  `before` cursors).
- `50a2fd4` — count only visible messages toward the session tail budget
  (#810): **session-reader.ts + pagination tests already landed with issue 01**
  (da1b28b transcript-system-message tests depend on countsTowardTail);
  remaining: nothing — only verification landed here.
- `b44017a` — see sessions written by another pi process (#796):
  external-write invalidation in session-reader + rpc-manager re-read +
  event-stream nudge. Directly relevant to us: desktop app and CLI pi share
  `~/.pi`. The upstream fix also touches `app/api/sessions/[id]` + hook —
  map the re-read onto our `sessionsGet` and the hook's reconcile path.

Order: `50a2fd4` → `b44017a` → `234e19e` (the big one last, on top of both).

Gate: typecheck ×2; full test suite; manual check — open app, append to a
session from CLI pi, watch the sidebar/`sessionsList` pick it up without a
forced refresh; perf sanity on a large project dir (session list scan).


## Answer

Resolved. Order: 50a2fd4 (already landed with issue 01) -> b44017a -> 234e19e.

- b44017a (#796): session-reader external-write probe (readEntryId/
  readLatestSessionEntryId, bounded 64KB tail) + rpc-manager evictIfDiskAhead
  (emits session_shutdown; our IPC push forwards it -> renderer reconnects,
  same SSE semantic) + hook force option. Re-home: sessionsGet gained
  `force` — evicts a stale live wrapper to a disk read and reports
  `wrapperRebuilt`; threaded through ipc/preload/pi-ipc. The test dropped
  in issue 05 returned and was adapted to the IPC options form (force spread
  + call-site counting).
- 234e19e (#940): session-view-cache + session-revision + perf libs, scanner
  tie-ordering, summary trees, catalog merge — renderer applied; route
  semantics re-homed: sessionsGet gained `tree: "summary"` (toSummaryTree +
  treeFormat + snapshotRevision via computeSessionRevision) and
  openSessionManager caching; sessionsContext uses openSessionManager;
  sessionsList gained `summary` (listSessionSummaries) — all threaded
  through the transport.
- AppShell x4 conflicts merged: catalog fast paths kept with window.pi
  transports; web-only push-client/tab-session imports dropped (#887 stays
  n/a); duplicate local handleOpenSession/handleSessionsChange/sessionCatalog
  declarations deduped.
- Ops: heredoc-embedded JS keeps losing backslash escapes (two test regexes
  arrived unescaped and silently matched nothing) — write scripts to files,
  or verify regex assertions with a direct .test() before running the suite.

Gate: typecheck x2 clean; npm test 1165/1169 (1 pre-existing Windows PATH
baseline); e2e 8 passed 1 skipped.
