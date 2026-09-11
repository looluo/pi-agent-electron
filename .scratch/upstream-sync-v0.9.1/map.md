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

## v0.9.1 batch (0ff1138..8366762, 2026-09 follow-up)

- 08 subagents-p0 — queue/resume/tintinweb/worktree/tool-selector cluster `b77a25f` `a31d5c5` `bbe2f7d` `2661247` `e3fbbf6` `b5b52f0` + merge `f106531` (—)
- 09 renderer-fixes-2 — `dab9850` `1b88ec7` `4787a14` `f607816` `a74aef8` `894c735` (—)
- 10 theme-controls-in-settings — `2eb95b9` (#772) removes the toolbar theme/language selector (02)
- 11 cascade-delete-quotas — `e83f4b5` + `6d53fd5`, sessions cascade + `pi:provider-usage:query` IPC (08)

n/a this batch: `55df7d7` (upstream e2e), `fad65c9`/`17ad5c5` (upstream AGENTS.md),
`c8c63a1`/`0ff32dd` (upstream docs), `effa464` (upstream CI), `8366762` (release commit;
local version independently bumped 0.9.0 → 0.9.1 to match v0.9.1).

New IPC surface: `pi:provider-usage:query`; `pi:subagents:settings:put` gained
`maxConcurrent`. lib/subagents.ts + lib/subagent-settings.ts verified byte-identical
to upstream 8366762 after the cluster.
