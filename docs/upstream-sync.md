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

Hotfix 2 (manual inspection catch): code rendered in a proportional font everywhere — file panel
source view, chat code blocks, `pre`/`code`, ChatInput, minimap. `--font-mono`'s first stack entry
`var(--font-noto-mono)` references a variable only upstream defines (`next/font` in
`app/layout.tsx`, deleted by Slice 5 `648e953`); per CSS custom-property substitution rules one
dangling `var()` invalidates the entire declaration, so every `font-family: var(--font-mono)` site
computed to the inherited sans stack instead of falling through to `Consolas`/`monospace`. No test
asserts computed styles, so only eyes on the UI caught it. Fixed by stripping the entry in
`pi-web/src/globals.css`; equal-glyph-width verified in Chromium. Repackaged to
`release-v2/win-unpacked` (running v0.9.0 instances lock `release/win-unpacked`) and
`release/Pi-Agent-App-0.9.0-portable.zip` replaced (145MB).

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
- `globals.css` `--font-mono` must not carry `var(--font-noto-mono)`. Upstream defines that variable
  via `next/font/google` (`Noto_Sans_Mono`, `variable: "--font-noto-mono"`) on `<html>` in
  `app/layout.tsx`; that file died with the Next.js retirement (Slice 5, `648e953`), and a dangling
  `var()` invalidates the whole custom property — see Hotfix 2 above. The line is correct in
  upstream's form factor and will never be "fixed" there: after every `globals.css` port, run
  `grep -c font-noto-mono pi-web/src/globals.css` and require 0 (strip the entry if the port
  reintroduced it).

## v0.8.11 → v0.9.0+ (`28bab3c..ce18006`) — synced 2026-09 (branch `sync/pi-web-v0.9.0`)

48 non-merge commits; tracker: `.scratch/upstream-sync-v0.9.0/` (issues 01–11, all resolved).

| Upstream | Subject | Status | Notes |
|---|---|---|---|
| `50b7f79` | feat: plugin update check + bulk update (#611) | ported | issue 08; `pi:plugins:check` IPC + semver dep |
| `7c5f4e6` | fix: ext request dialog collapsible (#612) | ported | + `rpc-manager-extension-ui.test.mjs` (deferred 06ed14f hunk applied with it) |
| `2cae813` | ci: checks + isolated session history E2E | n/a | Next E2E CI; our Playwright Electron suite covers |
| `5de2d9a` | fix: relative router.replace for sub-path deployments | n/a | no sub-path deployments under file:// |
| `cd6032b` | fix: session history across compaction pagination | ported | session-reader raw-order pages; tests realigned to final upstream state |
| `5f8f47b` | perf: windowed session list (#626) | ported | issue 03 |
| `1cbd96f` | feat: session search + cross-window sync | ported | issue 06; `pi:sessions:search` IPC; `sessionListVersion` on agentRunning+sessionsList |
| `8cbafdd` | perf: session metadata cache (#625) | ported | issue 05; lib/session-list-scanner |
| `6d7c5e0` | fix: warn images to non-vision model (#636) | ported | issue 03; ChatInput.test draft import switched to `@/lib/draft-store` (jiti instance identity) |
| `0ddb21f` | fix: minimap after compaction (#643) | ported | issue 03 |
| `07dd093` | fix: wide markdown tables scroll (#650) | ported | globals.css remap |
| `8aec7a1` | feat: thinking-expand-default setting (#639) | ported | issue 03 (pulled into fix batch — 80a44a5 builds on it) |
| `67d65a5` | fix: process grouping + thinking controls | ported | issue 03; ThinkingIcon |
| `7047460` | style: drop redundant settings descriptions | ported | issue 03 |
| `55485b9` | fix: cache highlight tree (#653) | ported | issue 03 |
| `9dceb23` | feat: inline video preview (#655) | ported | issue 09; IpcFileWatchSource adaptation; electron files service video MIME |
| `9cf8d4d` | fix: delete sessions with missing parent (#659) | ported | issue 05; sessionsDelete guard |
| `2e1c402` | fix: widget trigger area shrink (#670) | ported | globals.css remap |
| `6ac72b2` | fix(i18n): localize tooltips/aria (#668) | ported | issue 03 |
| `cc1394d` | fix: scroll long ext labels (#675) | ported | globals.css remap |
| `2356904` | fix: ext dialog keyboard nav + countdown | ported | issue 03 |
| `ff63346` | fix(skills): frontmatter fence variants (#690) | ported | shared lib; electron skills service benefits |
| `edf574a` | fix: renotify repeated notifications (#701) | ported | issue 10; renderer Notification renotify |
| `e9f954a` | feat: idle timeout via env (#665) | ported | issue 10; env resolves in main process |
| `abb74bf` | feat(input): Alt+Enter follow-up (#657) | ported | issue 03 |
| `bf4713c` | test: notification expectations | ported | with edf574a |
| `f3925bf` | feat: Mermaid preview (#693) | ported | issue 03 |
| `80a44a5` | fix: thinking block borders | ported | issue 03 |
| `0c525c8` | fix: Windows drive roots in file routes (#703) | ported | issue 09; `filePathFromApiSegments` |
| `f57b565` | fix: preserve sessions with extension work (#705) | ported | issue 05; session-liveness registry (web-push import stripped per convention) |
| `b315bd3` | fix: opaque PWA icons (#718) | n/a | PWA |
| `9290c27` | feat: workspace terminal tabs (#695) | ported | issue 11; node-pty in main, `pi:terminal:*` IPC replaces HTTP/SSE; xterm.js renderer |
| `5f8056d` | fix: Ctrl/Cmd-click local file links (#708) | ported | issue 09 |
| `8c18f21` | fix: transparent icon backgrounds | n/a | favicon/PWA icons only |
| `18923e6` | fix: model selector visible on load fail (#711) | ported | issue 03; loadModels retry adapted to `window.pi.models` |
| `be428cf` | fix(mobile): streaming scroll follow (#715) | n/a | mobile-web |
| `039e843` | feat: chat width + font size (#704) | ported | issue 04 |
| `77ffe3c` | fix(chat): preserve unsent drafts (#720) | ported | issue 03; parked-draft keys |
| `430fe4d` | fix(chat): per-session reading positions (#723) | ported | issue 03; loadContext `{tail,signal}`+return over IPC |
| `092b5d4` | feat(settings): appearance simplification + resets | ported | issue 04 |
| `06ed14f` | chore(deps): pi packages 0.85.1 | ported | issue 01; PlainTextTheme muted/text keys |
| `c0abfc2` | feat: branch from selected text (#698) | ported | issue 07; ChatWindow keeps fork-only onTitleGenerated |
| `237d0ca` | feat: enable built-in subagents | ported | issue 02; + v0.8.11-sync drift fix (child-session robot glyph in SessionSidebar) |
| `b8d0043`+`8463025` | style: chat display grouping | ported | issue 04 (with 039e843; depends on c0abfc2 keys) |
| `0d1df12` | Release v0.9.0 | n/a | independent version |
| `edf0deb` | fix: delete unpersisted runtime sessions (#440) | ported | issue 05; ENOENT-tolerant delete |
| `ce18006` | fix: Linux terminal prebuilds + load-failure reporting (#734) | ported | issue 11; manager diagnostics |

Verification: `npm run typecheck` clean; `npm test` 859/864 (1 pre-existing Windows
PATH baseline failure; win32-only skips incl. ConPTY pid/mock-timer quirks);
`npm run test:e2e` 7/7; `package:dir` + packaged-probe 9/9 (node-pty + ConPTY
unpacked, subagents default-off gate reworded).

Non-mainline upstream refs (recorded, not tracked): `v0.10.5`/@axello hard fork
from v0.8.7 (socket.io reverse-proxy terminal, background service); `v0.9.0-fork`
(e48ba2e) display-only session folders — external-port candidate.

New IPC surface this sync: `pi:sessions:search`, `pi:plugins:check`,
`pi:terminal:*` (6 channels + per-subscription push). `agentRunning`/`sessionsList`
responses now carry `sessionListVersion`.
