# 03: slice 2: files / file-index / git / cwd / worktrees

Status: resolved

Blocked by: 02

- Port file-access allow-list roots + /api/files + file-index + git status/diff + cwd validate/browse/default-cwd + worktrees routes as typed facade handlers
- Keep lib/path-security.ts isPathWithinRoots as the single boundary implementation
Gate: FileExplorer browses and FileViewer opens files; worktree create/remove works

## Comments

Resolved in 3eaf28a. Gate verified via slice2-probe (17/17): pifile protocol fetch (list/read/meta with allow-list + session-reference gating), upload + conflict detection + overwrite, watch connected AND real change events, file-index, git status/diff, worktrees (repo shows 2 worktrees), cwd validate/browse, default-cwd, home, project-trust. Findings: custom scheme needs standard+secure+supportFetchAPI+stream+corsEnabled privileges (plain handler gives "Failed to fetch" cross-origin); upload strategies are error/overwrite/skip; progress is per-file not per-byte over IPC (accepted UX change); FileExplorer git status colors + DownloadLink/FileViewer download now fetch->blob via protocol.