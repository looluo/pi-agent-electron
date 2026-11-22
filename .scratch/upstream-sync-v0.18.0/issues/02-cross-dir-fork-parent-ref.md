# Cross-directory fork copies keep a dangling parentSession when the source is deleted

Status: needs-triage
Found: 2026-11-22, third-party review of the v0.18.0 sync (P3)

## Problem

`forkSessionIntoCwd` (029e5896/#1699, ported this sync) copies the whole
session file into a session directory under a DIFFERENT folder, with the
copy's header `parentSession` pointing at the source file. Both delete entry
points re-parent surviving children by scanning only the directories of the
deleted files themselves (`readdirSync(dir)` in the delegated
`deleteSessions`, `scanDirs` from `deletedPaths`), so a cross-directory copy
is never visited: deleting the source leaves the copy's `parentSession`
pointing at an unlinked file even when a nearer ancestor survives. Verified
by the reviewer with real session files through both the single and the batch
entry points.

This is **upstream's behavior too**: the `[id]` DELETE route and the
`/api/sessions/delete` route both delegate to `lib/session-delete.ts`, whose
scan has the same directory scope. The desktop fork gained the feature at the
same commit as upstream, so this ticket records the limitation rather than
diverging the delete semantics mid-sync.

## Impact

`parentSession` is display metadata (the sidebar's lineage link): the copy
opens and branches fine; only its lineage to the deleted source is stale.

## What a fix needs (here or upstream)

After computing `deletedPaths`, also visit every session directory known to
the catalogue (`listAllSessions`) — or model lineage by id rather than file
path — and re-point any child whose `parentSession` names a deleted file.
Both entry points get it for free once it lives in `deleteSessions()`.

## Comments
