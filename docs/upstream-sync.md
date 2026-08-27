# Upstream sync ledger — agegr/pi-web

This repo forked pi-web at v0.8.9 (upstream commit `2a6e537`, imported via `de4373d`) and owns the
renderer source (ADR-0004). Upstream is therefore **not a merge source** — improvements arrive by
selective manual port, and every reviewed upstream change is recorded here so drift stays visible.

Mechanics for each port (helper: `scripts-dev/port-patch.sh`):

- renderer files: `git show <sha> -- components hooks lib` → `git apply --3way --directory=pi-web/src`
  (upstream root paths map to `pi-web/src/`; `app/globals.css` maps to `pi-web/src/globals.css`)
- `app/api/**` routes: re-home into `electron/main/services/` behind typed IPC or `pifile://`
- transport: every `fetch('/api/…')` / SSE assumption is rewritten to `window.pi.*` / push channel
- upstream diffs computed against their own history may reference commits we skipped — resolve by
  taking the semantic change, not the literal hunk

Status vocabulary: **ported** (in this repo, adapted), **n/a** (web/HTTP form factor we dropped,
ADR-0003), **deferred** (ticketed under `.scratch/upstream-sync-v0.8.11/issues/`).

## v0.8.9 → v0.8.11 (`2a6e537..28bab3c`) — synced 2026-08

| Upstream | Subject | Status | Notes |
|---|---|---|---|
| `5014aaf` | perf(files): skip highlighting long sources (#469) | ported | FileViewer lightweight source view |
| `73008d5` | feat: Pi Web version check opt-out (#485) | n/a | upstream self-update notice; our app-update check is own code (electron `services/models-auth.ts`) |
| `64ae8d7` | feat: session completion via Web Push (#496) | n/a | no web push in Electron; desktop notifications already exist |
| `fd1593c` | feat(i18n): Traditional Chinese locale (#512) | ported | incl. localized session timestamps |
| `70c871b` | feat: render tool-result images inline (#499) | ported | lazy URL served via `pifile://session/…` (files-protocol → `sessionToolResultImage`) |
| `e44639f`+`b80ed3d` | fix: same-origin proxy relaxation | n/a | HTTP request security; no server |
| `546dc5d` | fix: improve built-in slash command dispatch | ported | |
| `d5ec3bc` | fix: preserve slash command input behavior | ported | |
| `36f01a3` | fix: report why the Next.js child stopped (#597) | n/a | no Next.js child process |
| `7c74e93` | feat: add web clone command (#518) | ported | `/clone` builtin + session-replacement guards in rpc-manager |
| `9db0cce` | fix(files): block script execution for SVG documents (#520) | ported | CSP + nosniff headers in `pifile://` `streamFile` |
| `70d3896` | fix(skills): explicit-false SKILL.md corruption (#519) | ported | shared `lib/skill-frontmatter.ts` used by skills service |
| `1906134` | perf: resolve session paths without catalogue scans (#526) | ported | session-reader cache |
| `1218381` | fix: allow LAN access to the dev server (#532) | n/a | LAN deliberately dropped (ADR-0003) |
| `9a103fb` | fix: one-line extension widgets expandable (#539) | ported | |
| `ff57028` | fix: wrap multiline extension status text (#535) | ported | |
| `ed52b61` | fix: fill iOS standalone viewport (#547) | n/a | PWA/iOS |
| `a5630c1` | feat(sidebar): remember last custom cwd | ported | |
| `460da47` | fix: toolbar actions in narrow sidebars (#549) | ported | |
| `04abe1c` | chore: remove unused Bun lockfile | n/a | no `pi-web/bun.lock` here |
| `93633c8` | fix: monotonic token/cost counters across compaction (#557) | ported | `lib/session-stats.ts` + `stats` in sessionsGet |
| `a5fccdc` | feat(cli): `--help` for startup options (#574) | n/a | no pi-web CLI |
| `7ee7818` | feat(notice): full toast text, top-right, hover-pause (#558) | ported | |
| `d728526` | fix: emit session_shutdown on every dispose path (#575) | ported | rpc-manager from upstream d728526, web-push coupling stripped |
| `68cd261` | fix: bound session history to a tail window (#587) | ported | `tail`/`before` pagination over IPC; iterative BranchNavigator |
| `5f74a19` | test: fix component-test harness dual React (#588) | n/a | our harness (jiti, relative imports) has no dual-React issue |
| `5f35d6f` | fix: model-emitted bracketed math blocks (#595) | ported | |
| `9d7cd52` | fix(images): compress oversized attachments (#590) | ported | |
| `b24ecad` | feat(web): file search in explorer sidebar (#591) | ported | rides `window.pi.fileIndex` IPC |
| `fe684c8` | feat: extension widget ANSI colors (#601) | ported | `ansi_up` dependency added |
| `353757b` | feat: Project Info (git branch/worktree) in session panel (#605) | ported | via `attachSessionProjectInfo` in sessionsGet |
| `20a47a2`+`f748f52` | system panel: tool definitions + split panels | ported | SystemPromptPanel + ToolDefinitionsPanel |
| `29b2d3e` | fix: restore preferred tools for idle sessions | ported | rpc-manager + agent service |
| `626f327` | fix: hide branch controls for linear sessions | ported | `hasSessionBranches` |
| `ac7ccbc`+`cbb464d` | fonts: system font stack (reverted upstream) | n/a | net zero upstream |
| `03dad64` | fix: scrollable extension select dialog (#609) | ported | |
| `a3bbdee` | fix: iOS status bar modal offset (#604) | n/a | PWA/iOS |
| `baa600b`…`96c643a` | built-in subagents cluster (~25 commits) | ported | issue 01 resolved; ships dark (default off); pulled SettingsUi/settings-navigation/ModelSelector/settings.css + ChatInput ModelSelector hunk (4903dcb) and chat-only/session-tool-selection/powershell-settings libs as deps |
| `b6416c5`…`c8de95e`+`081c5b1` | settings unification cluster (SettingsPanel etc.) | ported | issue 02 resolved — SettingsPanel rollout + merged auth providers (602b1b6) + tools-settings IPC; AgentsConfig stays unmounted per upstream 96c643a |
| `a5738cf` | feat: persisted chat-only sessions | ported | issue 03 resolved — lib layer came with 01; UI preset + set_tools recreation dispatch + top-level toolNames wiring closed here |
| `602b1b6` | refactor: trim unused frontend infrastructure | ported | residue completed in issue 04: AnsiText switch in ExtensionStatusBar/ChatWindow custom panel, hand-rolled ansi parser deleted; merged auth-providers + ProviderIcon came with issue 02 |
| `024be0b` | refactor: remove unused running sessions SSE | ported | broadcaster (notifyRunningChange/subscribeRunningSessions) deleted in issue 04 after audit: our poll channel `pi:agent:running` is alive and kept |
| `55164b5` | chore: upgrade pi dependencies to 0.84.3 | ported | issue 05 resolved; pinned `@earendil-works/pi-*` to 0.84.3, no source changes needed |
| `a91c830` | docs: dev server troubleshooting | n/a | no Next dev server |
| `28bab3c` | Release v0.8.11 | n/a | we version independently (`pi-agent-desktop`) |

Verification for this sync: `npm run typecheck` clean, `npm test` 643/645 (1 pre-existing Windows
PATH-separator failure, 1 skipped), `npm run test:e2e` 7/7.

2026-08 follow-up: pi SDK deps upgraded to 0.84.3 (issue 05 resolved — same verification gate);
subagents cluster (issue 01) unblocked.

2026-08 follow-up 2: subagents cluster ported (issue 01 resolved — same gate; 744 tests, 11 skipped
of which 10 await issue 02's cross-component rollout). rpc-manager now tracks upstream at
`ec98e1c` (web-push still stripped). New IPC surface: `pi:subagents:*` (8 channels) +
`pifile://` unchanged. chat-only libs landed early as rpc-manager deps (issue 03 UI still open).

2026-08 follow-up 3: settings cluster ported (issue 02 resolved — same gate). SettingsPanel is the
single config surface (models/skills shortcuts + settings button); Models/Skills/Plugins at
28bab3c on typed IPC; auth providers merged (602b1b6); `pi:tools:settings:*` added; AgentsConfig
unmounted + `isBuiltInSubagentsEnabled()` hard-false (upstream release gate).

2026-08 follow-up 4: chat-only UI closed (issue 03 resolved — same gate). ChatInput `chat-only` preset, agent
service set_tools -> setRpcSessionTools interception (boundary-crossing session recreation), and a
real fix: sessionsGet `toolNames` promoted to the response top level where the renderer reads it.

2026-08 follow-up 5 (final): issue 04 resolved — rpc-manager realigned to 28bab3c (picking up the
081c5b1 PowerShell hunks issue 02 had missed: without them the shell-tool toggle was inert at
runtime), dead running-broadcaster deleted after audit, ansi parser replaced by AnsiText in both
remaining call sites. **All five tickets resolved; v0.8.11 sync complete.**

Packaged build (v0.9.0, post-sync): `npm run package:zip` → `release/win-unpacked/` (361MB) +
`Pi-Agent-App-0.9.0-portable.zip` (139MB). Packaged-exe smoke via `scripts-dev/packaged-probe.mjs`
(CDP): 9/9 — bridge, sessionsList, subagents settings (release gate off), tools settings (win32),
merged auth providers, home, provider sprite + catppuccin icons load under file://, Models panel
renders provider icons.

Hotfix (manual test catch): provider icons vanished in the packaged app — upstream's ProviderIcon
(602b1b6) used an absolute `/provider-icons.svg#sym`, which under the file://-loaded renderer
resolves to the filesystem root and silently fails (dev/E2E never saw it — they run on
http://localhost). Same latent bug existed for `/icons/catppuccin/...` in FileIcons since the
original fork (file-explorer icons were broken in every packaged build). Both now document-relative;
regression-guarded by `components/asset-paths.test.mjs` + two probe checks.

## External PR ports (not in upstream)

Changes pi-web never accepted, carried in this fork. Recorded here so drift against upstream stays
visible.

- **pi-web PR #548** — maximized file panel layout (commit `71baeed`).
- **pi-web PR #45** — automatic session titles. Upstream rejected the PR and later shipped manual
  naming (`auto-name`) instead; this port keeps the PR's client-side trigger but **shares the
  manual path**: `sessionsAutoName` gained a `skipIfNamed` option (guard before `startRpcSession`),
  the hook fires it silently on agent settle (`agent_settled` + no-stream finish, never bare
  `prompt_done`), skipping subagent sessions and in-flight duplicates. The PR's separate
  `generate-title` route with `completeSimple` was deliberately **not** ported. Contract guarded by
  `hooks/useAgentSession.auto-title.test.mjs`.

## Known upstream-compat notes

- Upstream's own zh-TW locale is incomplete for the tools-panel keys; we completed ours and the
  registry test enforces parity — keep new keys translated in all three locales when porting.
- `rpc-manager.ts` was byte-identical to upstream v0.8.9 before this sync; it now tracks upstream
  at `d728526` **minus** `web-push.ts` (import and `notifySessionComplete` call site removed; the
  optional completion-callback constructor parameter is kept for API compat).
