# Upstream commit census — v0.17.0 → v0.18.0 (`174bff96..2daa0d13`)

34 non-merge commits. **SDK wave: pi 1.5.2 → 1.6.0** (3443700a; all eight
`@earendil-works/*` exact-pinned via `npm install --save-exact`; the
pi-packages guard stays green). Executed as a file-level three-way merge (base
174bff96): 43 wholesale, 29 three-way (13 conflicted files, 18 hunks by hand),
15 new, 2 fork-absent (deliberate), 15 app/api rows of which 5 were re-homed
onto electron services. Helper: `scripts-dev/sync-classify.sh` +
`sync-apply.sh` + `pick-hunks.py`.

Counts: **ported 30**, **n/a 4** (web-auth throttle, Next bump + json-response
deletion, webpack export import, WSL explorer half of the squash) plus the
usual docs/demo/e2e/AGENTS.md/release rows.

| Theme | Status | Notes |
|---|---|---|
| SDK 1.6.0 (3443700a) | ported | eight packages exact-pinned; no adapter sweep needed |
| pi-web-bun squash (51fd0e76) | ported (WSL half n/a) | IME-Enter in API key field (ModelsConfig); atomic re-pointed child rewrite (atomic-file/session-delete wholesale); resume max_turns limiter + sidebar startup perf (subagent-runtime/session-list-scanner wholesale); `isPathWithinRoot` helper extracted — fork UNC guard re-homed into it as `return false` (verify-file-authorization HOLDS, seeds 20261115 + 777×20k); WSL explorer.exe (open-in-file-manager + route) n/a — the electron open-in-explorer service runs natively win32/darwin, never inside WSL |
| New session on a mid-run prompt (af37255a #1746) | ported | rpc-manager `announceUserMessageEntry` → `user_message_entry`; ChatWindow/MessageView `forkEntryId`/`liveUserEntryIds`; **fork and fork_branch now allow a running source** — the fork's stale refusals (upstream dropped them at #1023) deleted, `keepSource` + `UNSAVED_SESSION_FORK_ERROR` taken; rpc-manager.test's old fork-refusal expectation swapped for clone's |
| early tool results only while siblings pending (0a8d5314 #1747) | ported | rpc-manager + pi-types |
| dialog timeout like pi's TUI (28b59471 #1749) | ported | rpc-manager; new extension-timeout test |
| terminal: deleted folder answers the typed cwd-missing refusal (8a6bc878 #1750) | ported | re-homed onto electron `terminalCreate` (stat → 400 `cwdMissingBody`, `cwd must be a directory` check added) |
| files: stream backpressure (a834df33 #1748) | ported | re-homed onto pifile:// `createFileBodyStream` (`desiredSize` pause + `pull()` resume) |
| text selection stays fast in long transcripts (1e535737) | ported | `useSkipOffscreenRows` new; ChatWindow 3-way |
| terminal: answer a new shell's startup queries (b5e24407 #1736) + xterm replies to replayed history (a897a548 #1725) + touch autofocus (631e8379 #1703) | ported | TerminalPanel 3-way ×4 hunks; upstream's EventSource `awaitingHistory`/`drawingHistory` re-expressed for the IPC subscription (set in `connect()`, consumed in `applyEvent`, replay = first output); `shouldAutofocusTerminal` |
| paste markers inside pasted text (15a05b48 #1719) | ported | terminal-input wholesale |
| drafts survive a reload (9e49f585 #1740) | ported | draft-store wholesale; history-edit-draft/live-user-entry tests new; SessionSidebar clears a family's drafts on delete — gated on the IPC's 200, VM test scripted onto `window.pi.sessionsDelete` |
| subagents: steer keeps the report (36812c2f #1739), report into the parent's run (d40a8dd3 #1742), resumed-child rename (84b5884c #1737), model id with a slash (4fc8fde4 #1751) | ported | subagent-runtime wholesale + tests |
| record the live model on the branch (77b69f1f #1734) | ported | rpc-manager `recordModelOnBranch` on `preflightResult("started")` (fork's `disposeMcpHost` kept alongside); integration test new |
| plantuml fences on plantuml.com (a06dfde3 #1741) | ported | lib/plantuml + PlantUmlBlock new; renders as `<img src=https://…>` — loads under file:// (no CSP); zlib-dependent known-answer vectors adapted to round-trip (node 26 bundles zlib 1.2.12; upstream CI's 1.3.x emits different deflate bytes) |
| fork a session whose folder is gone into another folder (029e5896 #1699) | ported | session-fork lib wholesale; `sessionsFork` service + `pi:sessions:fork` options gain `cwd` (preload + pi-ipc in lockstep); missing-cwd banner + picker in the renderer |
| usage in batches the stats route accepts (5921408b #1728) | ported | `fetchAgentUsage` re-homed onto the pi:sessions:stats IPC (service cap 200 already matched); test stubs `window.pi.sessionsStats` |
| git children scrub the host env (c89e39ab #1732) | ported | git-environment new; re-homed onto electron workspace.ts `ls-files` (`projectGitEnvironment()`); file-tree-visibility/git-changes/worktree took it wholesale |
| plugin update children scrub the host env (cfac6bc2 #1693) | ported | plugin-updates `updateCheckEnvironment`; the fork's `runNpm` routing kept, env now rides the scrub; test additionally scrubs `npm_config_registry` (an `npm test` lifecycle exports the user's mirror, which outranks the project .npmrc) |
| session search keeps unchanged text (0001640d #1692) | ported | session-search wholesale |
| escapes/emoji/streaming/stats/models fixes (9e30af85, c488ad1d, 8c4a84c9, 345112e6, 8cc10d90) | ported | message-display/chat libs wholesale/3-way |
| tree glyphs in monospace columns (f97292ee #1707) | ported | "Terminal Drawing" faces prepended to `--font-mono-default`; fork's CJK-safe stack kept, noto stays out (`grep -c font-noto-mono` = 0) |
| Next 16.4.6 + json-response deletion (c7be0e0a) | n/a | Vite; the fork never carried lib/json-response |
| export native import (1017a50c) | n/a | route-only |
| login throttle (3af17b7a #1694) | n/a | web-auth; no HTTP surface |
| Release v0.18.0 (2daa0d13) | n/a | local version aligned 0.18.0 |

## Fork transport re-homes (new this sync)

- `pi:sessions:fork` options gain `cwd` (service + preload + pi-ipc types).
- `pi:terminal:create` now answers `{status: 400, body: cwdMissingBody}` for a
  deleted/moved folder (was 403 Access denied) and rejects non-directories.
- pifile:// stream pauses on backpressure and resumes on pull.
- electron workspace `ls-files` runs under `projectGitEnvironment()`.
- No new channels otherwise; preload ↔ main channel set otherwise unchanged.

## Local-test adaptations

AgentSessionPanel.stats (window.pi.sessionsStats stub), SessionSidebar drafts
(VM `window.pi` + status-gated clearing), plantuml (round-trip instead of
zlib-byte vectors), quote-caret (QuoteSelectionPopover only — the callback
moved out of ChatWindow), SettingsPanel (login-page test dropped, drafts test
kept against the inert web-auth block), plugin-updates (npm lifecycle registry
scrub), rpc-manager.test (mid-run refusal expectation: clone, not fork).

## Known fork notes carried forward

- Star-save of the default model still has no IPC home
  (`.scratch/upstream-sync-v0.17.0/issues/01-star-save-default-model-ipc.md`,
  needs-triage; pre-existing at v0.15.0).
- SettingsPanel's web-auth sign-out block stays inert (webAuthEnabled is
  always false under file://); the drafts clearing rides it. The cache-miss
  IPC guard test still pins the one live settings transport.

## Verification

typecheck clean (renderer + electron); `npm test` 3060 = **3053 pass / 0 fail
/ 7 skip** (same environmental skips as the 2964-pass baseline; +89 tests from
the wave); `npm run test:e2e` **13/13** (incl. terminal PTY round-trip and
bash full-output specs); pi packages verified at 1.6.0 (guard green in-suite);
vite build clean; file-authorization check HOLDS (seeds 20261115 ×3000 and
777 ×20000); app-drive journeys on the built app: **shell, session-history,
prompt-reply (live LLM on SDK 1.6.0) PASS** — the shipped terminal and
bash-full-output journeys fail identically on the pre-sync HEAD build
(journey defects, ticketed as issue 01; their paths are covered green by the
e2e spec suite on the same build). Local version aligned 0.18.0.
