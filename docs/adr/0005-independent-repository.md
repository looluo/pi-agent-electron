# Develop the desktop app as an independent repository

Status: accepted

The Electron rewrite began as a worktree branch of `looluo/pi-agent2` (the Electron IPC migration, then the pi-web v0.8.9→v0.8.11 sync). After ADR-0003/0004 the two lines shared no build, runtime, or release process: this side owns a forked renderer, an electron-vite build, portable-directory packaging, and its own version line (`pi-agent-desktop` 0.9.x), none of which main uses. A merge would reconcile nothing and risk both, so the worktree was cut over into `looluo/pi-agent-electron`: history preserved, branch renamed to `main`, pushes and releases land here. `agegr/pi-web` remains the only upstream, still consumed by selective port per ADR-0004 with the ledger in `docs/upstream-sync.md`; the app's update check now reads this repository's GitHub Releases.

## Consequences

There is no merge path back to `looluo/pi-agent2`; either side may delete references to the other without notice. Shared fixes must be cherry-picked by hand in both directions, the same discipline already accepted for pi-web in ADR-0004. Versioning, releases, and the update-check feed are owned here — publishing a GitHub Release on this repo is what makes the in-app update notice fire (404 until then, reported as up-to-date).
