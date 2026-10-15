# Upstream sync — pi-web v0.8.11 → v0.9.0+

## Notes

Selective port of `agegr/pi-web` `28bab3c..ce18006` (48 non-merge commits, v0.9.0 + 2
post-release fixes) into the Electron fork per ADR-0004, on branch `sync/pi-web-v0.9.0`.
Ledger: `docs/upstream-sync.md` (per-commit status appended at the end of the port).

Non-mainline upstream refs deliberately NOT tracked:
- `v0.10.5` / @axello/pi-web line — hard fork from v0.8.7 (socket.io reverse-proxy terminal,
  background service, CLI); divergent lineage, shares nothing after v0.8.7.
- `v0.9.0-fork` (e48ba2e) — display-only session folders, contributor branch; watch as
  external-port candidate, not part of this sync.

Issue map (blocked-by in parens):

- 01 sdk-0.85.1 — `06ed14f` deps bump, rpc-manager hunk (—)
- 02 subagents-enable — `237d0ca` mainline version of the beta revert (01)
- 03 renderer-fix-batch — 17 pure-renderer fixes/features + `ff63346` skill-frontmatter (01)
- 04 appearance-settings — `039e843` `092b5d4` `67d65a5` `8aec7a1` display cluster (03)
- 05 sessions-service — `8cbafdd` `9cf8d4d` `f57b565` `edf0deb` `cd6032b` (01)
- 06 session-search — `1cbd96f`, new `pi:sessions:search` IPC (05)
- 07 branch-from-selection — `c0abfc2` (#698) (03, 04)
- 08 plugin-updates — `50b7f79` (#611), main-process service (01)
- 09 file-panel — `9dceb23` `5f8056d` `0c525c8` `55485b9` (01)
- 10 notifications-idle — `edf574a` `bf4713c` `e9f954a` (01)
- 11 terminal-tabs — `9290c27` + `ce18006`, Electron main-process node-pty service (01)

n/a commits (recorded in ledger, no ticket): `0d1df12` (independent version), `2cae813`
(Next E2E CI), `b315bd3`/`be428cf`/`5de2d9a` (PWA/mobile-web/sub-path deployment).

## Decisions so far

- 2026-09-07: sync starts from `e83c4a7` (main carried two post-v0.8.11-sync hotfixes:
  e2d11f9 auto-title trigger, e83c4a7 font-mono regression — unrelated to this range).

- 2026-09-07: issue 01 resolved (f97debd). SDK at 0.85.1. Theme now derives
  scrollbarTrack/Thumb/searchMatchText from muted/text — any custom Theme
  construction must provide them. git apply --3way atomicity lesson recorded.

- 2026-09-07: issue 02 resolved (d2ad332). Subagents live (default off,
  user-settable). Drift caught: child-session robot glyph had been missed in
  the v0.8.11 cluster port — imported SettingsPanel.test.mjs guards it now.

- 2026-09-07: issue 03 resolved (f67c1c8). 19 commits in; thinking cluster
  (8aec7a1+67d65a5) pulled forward into 03 because 80a44a5 builds on it;
  b8d0043/8463025 re-homed to issue 04 with 039e843/092b5d4. loadContext now
  returns context and accepts {tail, signal}; ChatWindow gained searchTarget
  plumbing early (430fe4d brings it) — issue 06 only needs the search UI/API.

- 2026-09-07: issues 04+07 resolved together (be35317). Ordering lesson:
  c0abfc2 precedes b8d0043/8463025 upstream; port in upstream order or
  collapse duplicates afterward. Remaining: 05 sessions, 06 search, 08
  plugins, 09 files, 10 notifications, 11 terminal.

- 2026-09-07: issue 06 resolved (f91f5a6). New IPC: pi:sessions:search;
  agentRunning + sessionsList now carry sessionListVersion. Frontier:
  08 plugins, 09 files, 10 notifications, 11 terminal.

- 2026-09-07: issue 11 resolved (9eb1996). All 11 tickets resolved; sync
  code-complete. Remaining wrap-up: ledger section in docs/upstream-sync.md
  + packaged probe run.
