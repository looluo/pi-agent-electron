# Issue 06: session-perf-batch

Type: task
Status: ready-for-agent
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
