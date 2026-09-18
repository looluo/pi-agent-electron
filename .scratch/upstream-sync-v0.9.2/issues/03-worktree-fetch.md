# Issue 03: worktree-fetch

Type: task
Status: resolved
Blocked by: —

744ee93: configurable git() timeout (fetch 60s n/a — implicit fetch dropped
upstream; worktree add 5min for 30k+-file repos), new branches start from
refs/remotes/origin/<branch> when present, else HEAD.

## Answer

Resolved. lib/worktree.ts was byte-identical to upstream pre-fix; port-patch
clean. No local tests for worktree.ts (same as upstream).
