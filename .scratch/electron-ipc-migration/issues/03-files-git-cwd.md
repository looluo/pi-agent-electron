# 03: slice 2: files / file-index / git / cwd / worktrees

Status: claimed

Blocked by: 02

- Port file-access allow-list roots + /api/files + file-index + git status/diff + cwd validate/browse/default-cwd + worktrees routes as typed facade handlers
- Keep lib/path-security.ts isPathWithinRoots as the single boundary implementation
Gate: FileExplorer browses and FileViewer opens files; worktree create/remove works

## Comments
