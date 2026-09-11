# Upstream sync — pi-web v0.9.0+ → post-0ff1138

## Notes

Selective port of `agegr/pi-web` `ce18006..0ff1138` (16 non-merge commits, post-v0.9.0
follow-ups) into the Electron fork per ADR-0004, on `main` (batch small enough to skip a
dedicated sync branch). Ledger: `docs/upstream-sync.md`.

Batch landed alongside one local bug fix: the terminal-tabs port (issue 11, `9eb1996`)
reshaped `handleCloseFileTab` and friends to call `setRightPanelOpen(false)` directly,
dropping the `rightPanelMaximized` reset from the PR #548 port — closing the last file
while maximized left an empty maximized panel. All panel-close paths now exit through
`handleRightPanelClose()` again (terminal-aware conditions kept).

Issue map (blocked-by in parens):

- 01 renderer-fixes — `a26cc68` `5173f6a` `d10988d` `f4a700d` pure renderer (—)
- 02 themes-selector — `448e146` readable themes + toolbar selector (01)
- 03 session-model-forks — `ed840ed` `585d56c` `def1478` session cluster (—)
- 04 text-preview-pagination — `0e71201`, `offset` param on pifile:// read (—)
- 05 plugins-top-level — `ef51ffd`, standalone extensions in plugins IPC (—)
- 06 terminal-utf8 — `2e914db` (#751) shell locale default (—)
- 07 selected-session-lease — `0ff1138` keep-alive, new `pi:agent:lease` IPC (03)

n/a commits (recorded in ledger, no ticket): `e685cac` (browser password login — HTTP
form factor), `b1a7296` (upstream's own e2e expectation), `09383ae` (HTTP gzip),
`3e9fcfa` (iOS web push).

New IPC surface: `pi:agent:lease`.
