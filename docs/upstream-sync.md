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
- full-range syncs run as a file-level three-way merge via `scripts-dev/sync-classify.sh` /
  `sync-apply.sh` / `pick-hunks.py` (re-runnable, not hand-per-patch)

Status vocabulary: **ported** (in this repo, adapted), **n/a** (web/HTTP form factor we dropped,
ADR-0003), **deferred** (ticketed in that sync's tracker at the time).

Standing n/a, every sync: web push + its SSE auth guards (IPC push covers the semantics), web
password login, PWA/iOS/mobile-web, the pi-web CLI, Next.js/docker/CI/docs/demo.

Fork-local re-homes to remember when porting: `hasFinalAssistantAnswer` and
`findFinalAssistantIndex` live in `lib/message-display.ts` (moved out of ChatWindow.tsx,
2026-11) with an epilogue walk over trailing non-pi tool calls — port upstream changes
to ChatWindow's copies into the lib versions, and keep `splitFinalAssistantBlocks`'
trailing-run exemption for extension/MCP tools in mind.

## v0.18.0 → v0.20.0 (`2daa0d13..ef517d7c`) — synced 2026-11

55 non-merge commits (v0.19.0 + v0.20.0); census:
`.scratch/upstream-sync-v0.20.0/commit-census.md`.
**SDK 1.6.0 → 1.7.0** (all eight `@earendil-works/*` exact-pinned; `pi-packages`
guard green). Executed as a file-level three-way merge (base `2daa0d13`): 129
wholesale (incl. `app/sidebar.css` & `app/sidebar-menu.css` added to
`sync-classify.sh`), 60 three-way (32 clean, 28 files / 62 conflict hunks by
hand), 47 new (2 web-only `frame-ancestors` files dropped), 5 fork-absent
(deliberate); behavioral `app/api/**` additions/changes re-homed onto Electron
services + typed IPC.

| Theme | Status | Notes |
|---|---|---|
| SDK 1.6.1 + 1.7.0 (ea36a8f9, 0de48724) | ported | all eight `@earendil-works/*` exact-pinned at 1.7.0 |
| Global HTTP proxy UI (46ae7469/#1811), queue modes (29654472/#1818, 7e9d663a/#1819), `notices.*` settings (pi 1.6.1) | ported | new `http-proxy.ts`, `queue-modes.ts`, `notices.ts` services + IPC channels; `electron/main/index.ts` calls `configureHttpDispatcherFromSettings()`; `sessions.ts` attaches transcript notices; `HttpProxyForm.tsx` & `SettingsPanel.tsx` re-homed onto `window.pi.*` (web push omitted) |
| File tree management (0ce50c52/#1838) + folder uploads with subfolders (3288d545/#1786/#1840) + drop hint (a1e112ee) | ported | `filesManage` (`pi:files:manage`) + relative `path` uploads in `files-upload.ts`; `open-in-explorer.ts` adds `{ reveal }` via `shell.showItemInFolder` with allowed-roots check; `file-manage-client.ts` & `file-upload-client.ts` re-homed onto IPC; `FileExplorer.tsx` menu download uses `pifile://local/...` |
| `#` session references (daf24fff/#1801, bf81275e, 450471d6), extension slash-arg completion (08250338/#1829), sidebar date sort & row sizing (03fc9ef9/#1822, 25425543) | ported | `ChatInput.tsx` `#` session list re-homed onto `window.pi.sessionsList()`; `useAgentSession.ts` `requestArgumentCompletions` rides `pi:agent:command` |
| File link jump-to-line & split Git diff (1cea5e8d/#1792), large Git diffs (3a03bdb7/#1789), oversize session single-entry read (5e52245a/#1816), paged view cache alignment (64553be3/#1836) | ported | `sessions.ts` `sessionsThinking` & `sessionToolResultImage` switched to `readSessionEntryById`; `workspace.ts` `listWithGit` dedupes merge-conflict stages and `isDiffPathAllowed` uses `hasParentDirectorySegment` |
| Models bulk delete (685f17ac/#1831), unresolved stored API key (6c49208f/#1826), `input_modalities` & nested efforts (8a681588/#1820) | ported | `ModelsConfig.tsx` keeps fork `applyProviderRename` alongside bulk selection |
| Subagents: manual compaction wait (81988de0/#1798), package names in profile extensions (fc869ee0/#1802), default `subagent_type` gate (2161b858/#1833) | ported | `subagent-package-scope.integration.test.mjs` isolates `HOME`/`USERPROFILE` |
| Chat/composer/markdown/offline/MCP refactors (folded cost sum a78cb4f4, offscreen rows 4b9f693a, `PI_OFFLINE` 73acfdee, `atomic-file` 56d14139, shared helpers) | ported | Windows `renameReplacing` retry moved into `lib/atomic-file.ts`; `mcp-bridge-fetch.ts` adds `PUT /api/tools/settings` for codemode mode/budget; `models-auth.ts` `appUpdateStatus` honors `isPiOffline()`; bare fetches in `ChatWindow.tsx` (`appUpdate`), `ProjectTrustDialog.tsx` (`projectTrustGet`), and `useAgentSession.ts` (`agentState`/`sessionsContext`) re-homed onto IPC |
| Page framing CSP (`proxy.ts` / `lib/frame-ancestors.ts`, 23f318cd/#1827), Releases v0.19.0 & v0.20.0 | n/a | web proxy form factor; local version aligned `0.20.0` |

Verification: typecheck clean (renderer + electron); `npm run build` clean;
`npm test` 3247 = **3240 pass / 0 fail** / 7 skip; `npx playwright test`
**13/13**; file-authorization check HOLDS (seeds 20261115 ×3000, 777 ×20000);
app-drive journeys on built `out/`: `shell`, `session-history`, `terminal`
**PASS**; `grep -c font-noto-mono pi-web/src/globals.css` = 0.

## v0.17.0 → v0.18.0 (`174bff96..2daa0d13`) — synced 2026-11

34 non-merge commits; census: `.scratch/upstream-sync-v0.18.0/commit-census.md`.
**SDK 1.5.2 → 1.6.0** (all eight `@earendil-works/*` exact-pinned; pi-packages
guard green). Executed as a file-level three-way merge (base 174bff96): 43
wholesale, 29 three-way (13 files, 18 conflict hunks by hand), 15 new, 2
fork-absent (deliberate); 5 app/api re-homes onto electron services.

| Theme | Status | Notes |
|---|---|---|
| pi-web-bun squash (51fd0e76): IME key field, atomic child rewrite, resume turn limiter, sidebar startup perf, `isPathWithinRoot` helper | ported | UNC guard re-homed into the new helper as `return false` (file-authorization check HOLDS at 3000 and 20000 cases); WSL explorer half n/a (electron open-in-explorer service runs native win32/darwin) |
| New session on a mid-run prompt (af37255a/#1746): `user_message_entry`, `forkEntryId` | ported | **fork/fork_branch now allow a running source** — the fork's stale refusals (upstream dropped them at #1023) deleted; `keepSource` + `UNSAVED_SESSION_FORK_ERROR` taken; rpc-manager.test's mid-run expectation swapped to clone |
| terminal cluster: deleted-folder refusal (8a6bc878), startup queries (b5e24407/#1736), replayed-history replies (a897a548/#1725), touch autofocus (631e8379/#1703), paste markers (15a05b48/#1719) | ported | `pi:terminal:create` answers `cwdMissingBody` 400 for a gone folder (was 403); TerminalPanel's EventSource history logic re-expressed for the IPC subscription (`awaitingHistory` in `connect()`, `drawingHistory` in `applyEvent`, replay = first output) |
| files: stream backpressure (a834df33/#1748), git env scrub (c89e39ab/#1732), plugin-update env scrub (cfac6bc2/#1693) | ported | pifile:// `createFileBodyStream` pauses on `desiredSize` ≤ 0, resumes on `pull()`; electron workspace `ls-files` runs under `projectGitEnvironment()`; plugin-updates keeps `runNpm` but rides `updateCheckEnvironment` |
| drafts survive reload (9e49f585/#1740), fork into another folder (029e5896/#1699) | ported | `pi:sessions:fork` options gain `cwd`; SessionSidebar clears a family's drafts on delete, gated on the IPC 200 |
| usage in batches (5921408b/#1728), search cache (0001640d/#1692), plantuml on click (a06dfde3/#1741), tree glyphs (f97292ee/#1707), escapes/emoji/streaming/stats/models fixes | ported | fetchAgentUsage re-homed onto pi:sessions:stats IPC batching; plantuml zlib vectors adapted to round-trip (node 26's zlib 1.2.12); noto stays out of `--font-mono-default` (guard 0) |
| subagents: steer keeps report (36812c2f), report into parent's run (d40a8dd3), resumed rename (84b5884c), slash in model id (4fc8fde4), live model on branch (77b69f1f/#1734) | ported | `recordModelOnBranch` on `preflightResult("started")`; fork's `disposeMcpHost` kept alongside |
| web-auth throttle (3af17b7a), Next 16.4.6 + json-response (c7be0e0a), webpack export import (1017a50c), docs/demo/e2e/AGENTS.md | n/a | form factor / upstream-internal |
| Release v0.18.0 (2daa0d13) | n/a | local version aligned 0.18.0 |

Verification: typecheck clean (renderer + electron); `npm test` 3060 =
**3053 pass / 0 fail** / 7 skip (same environmental skips as baseline);
`npm run test:e2e` **13/13**; file-authorization check HOLDS (seeds 20261115,
777×20k); app-drive journeys on the built app: shell, session-history,
prompt-reply (live LLM on SDK 1.6.0) **PASS**; the terminal and
bash-full-output journeys were red identically on pre-sync HEAD (journey
defects, ticketed at `.scratch/upstream-sync-v0.18.0/issues/01`, since
resolved by 433cf777; their paths pass in the spec suite on the same build).
Post-sync cross-model review (1 P1 / 3 P2 / 1 P3, all confirmed): the
fork-into-cwd flow had kept upstream's `/api/sessions/[id]/fork` fetch and was
dead under file:// — re-homed onto `window.pi.sessionsFork(sid, { cwd })` with
a transport-guard test (`useAgentSession.test.mjs`, no bare `/api` fetch in
`forkIntoCwd`); draft clearing gated on the IPC's real `{ ok: true }` (sidebar)
and `deleteSideChat` no longer treats the guard's `{ error }` as success; the
electron single-delete's hand-ported re-parent body (plain `writeFileSync`)
replaced by delegation to `deleteSessions([id])`, upstream's own route shape
(atomic child rewrites, surviving-parent walk); the P3 (cross-directory fork
copies keep a dangling `parentSession` when the source is deleted) is
upstream-identical dir-scoped scanning — ticketed as
`.scratch/upstream-sync-v0.18.0/issues/02` (open), not diverged.
`npm run package:mac` + packaged probe **13/13** (incl. terminal IPC round
trip in the packaged app). One more in-the-wild bug from this tree: the
Plugins panel's per-package switch had been 400'ing with "packages must be a
list of {source, scope}" since the v0.9.3 bulk port — the service gated the
bulk form on the action instead of on `packages` being present (upstream's
gate), leaving the single-package enable/disable branches unreachable;
regated to upstream's shape, service tests added (`plugins-route.test.mjs`).

## v0.15.0 → v0.17.0 (`9416a058..174bff96`) — synced 2026-11

106 non-merge commits; census: `.scratch/upstream-sync-v0.17.0/commit-census.md`.
**SDK 1.5.0 → 1.5.2** (all eight `@earendil-works/*` exact-pinned; the pi-packages
guard stays green). Executed as a file-level three-way merge (base 9416a058): 93
wholesale, 62 three-way (22 files, 55 conflict hunks by hand), 53 new, 29 app/api
re-homes. Helper scripts: `scripts-dev/sync-classify.sh` / `sync-apply.sh` /
`pick-hunks.py`.

| Theme | Status | Notes |
|---|---|---|
| SDK 1.5.2 (e911f7bc) | ported | mcp-sign-in, pi-sdk-internals (llamaCppExtension), transcript-notices-server adapted |
| llama.cpp built-in provider (47db4ef1) + Test model as chat (7d6b4a16) | ported | `pi:auth:api-key:set` gains serverUrl + catalog refresh; models services load the SDK's llama extension factory; integration + probe tests re-homed onto the services |
| built-in tools one-by-one (4ce18f38), provider display-name editing (08989e75/#1608, 1c2ccec2) | ported | `pi:tools:settings:put` gains `builtinTools`; ModelsConfig rides upstream's lifted editingName/applyProviderRename |
| Agents strip under the toolbar (25eec16a/#1681, 1eb21f78) | ported | AgentMiniStrip + agent-strip-lock new |
| session_start dialogs (#1678/#1682), slash-commands generation/stream holding | ported | rpc-manager waitForStateRead; useAgentSession requestSlashCommands |
| side-chat search (4cc85eb9/#1689), multi-term search (5f4cc884), unread markers (bcf4f2ef/#1618) | ported | sessionsSearch drops the side filter; `pi:agent:running` answers `serverNow` |
| chat cluster: stopped-reply marking, live `!` output, elapsed cards, queued-restore, emoji/token-width/scroll/copy fixes | ported | turn-views at upstream state; fork `isProcessToolCall` accepts the raw AI-sdk `name` shape |
| markdown/files cluster (~20 fixes: MIME, UTF-16 BOM, ranges, literal git paths, trailing spaces, watch heartbeat, previews) | ported | pifile:// byte-range 416; openFileWatch `ping` + IpcFileWatchSource `readyState` |
| uploads: one 100MB limit (bae035ee), async writes + umask perms (e1df9241) | ported | files-upload service |
| npx env scrub (e00f359b), export private tempdir (4c476d4d), skills/settings/i18n fixes | ported | npxEnvironment via project-command-env; fork keeps RunNpxOptions.env through the scrub |
| web push, SSE auth guard, CLI, docs/demo/CI, releases | n/a | IPC push already covers the guard's semantics; form factor |

**Boundary lesson re-learned**: moving `EXTENSION_REPORTED_CODE` into rpc-manager
(agent-client re-exporting it) silently pulled the whole main-side subtree
(session-reader → fs, npx → child_process) into the renderer bundle — only the
vite build catches this. The constant now lives in `lib/wire-codes.ts`, imported
by both sides.

Verification: typecheck clean; `npm test` 2971 = **2964 pass / 0 fail** / 7 skip;
`npm run test:e2e` **13/13**; pi packages verified at 1.5.2. Local version
aligned 0.17.0. Open ticket from the review:
`.scratch/upstream-sync-v0.17.0/issues/01` (star-save of the default model has
no IPC home — pre-existing at v0.15.0, still needs-triage).

## Earlier syncs (v0.8.9 → v0.15.0)

Compact index; the per-commit tables and tracker dirs were removed 2026-11
(derivable from this repo's git history; each sync's commit message carries its
headline decisions). Census pointers removed with them.

- **v0.14.1 → v0.15.0** (93ec18be, 2026-11; SDK 1.4.0 → 1.5.0, new `pi-schema`):
  models drag/Alt+arrows reorder + scoped-vs-all selector, side tabs restore with
  main session, streaming token/speed indicators, auth device-id (superseded our
  v0.14.1 port), file-panel tab drag, pi palette theme, PowerShell before cmd,
  top-bar height var. SubagentViewer + subagent-viewer-state deleted (upstream
  side-session redesign superseded them at v0.14.1).
- **v0.13.0 → v0.14.1** (85efcd93, 2026-11; SDK stays 1.4.0): side sessions
  `/side` (ADR 0007; createSideChat → `window.pi.sessionsFork(id, {side, name})`),
  taskbar attention badge → `pi:window:set-taskbar-badge` + setOverlayIcon,
  quote-selected-as-blockquote, git-changes Tree/List view, sandboxed HTML
  preview, tool-order carry, IME-Escape picker, 1h shared runtime. Latent fix en
  route: the agent switcher's stats route never worked under file:// →
  `pi:sessions:stats` (services/session-stats.ts).
- **v0.12.2 → v0.13.0** (490cd9d8, 2026-10; SDK 1.2.0 → 1.4.0): the read-only
  Debug panel + SSE observability wave **not adopted** (web form factor;
  `page-debug.ts` shim kept so merged code typechecks); queued-compaction,
  send-recovery (IPC lease re-shape `{running, awaitingInput, subagentsActive}`),
  models base-URL override + adaptive thinking, subagent wait budgets, the
  files/markdown fix cluster, worktree timeouts. Test transport re-homes onto
  the ipc-bridge-adapter fixture.
- **v0.12.1 → v0.12.2** (1203c615, 2026-10): 14-palette theme system, cache/cost
  notices, per-turn durations, agent switcher time/tokens/cost, subagent
  worktree lifecycles, tail-window session scan, precise-subdirectory uploads.
- **v0.12.0 → v0.12.1** (52e1fbd4, 2026-10; SDK 1.1.0 → 1.2.0): every
  `@earendil-works/*` exact-pinned + the `pi-packages.test.mjs` guard (the
  caret-pairing hazard); MCP resources-listing semantics.
- **v0.11.0 → v0.12.0** (3a78600b, 2026-10; SDK stays 1.1.0): bash fix batch,
  workspace file-tab parking (PR #548 superseded by `file-tab-state`),
  sessions/sidebar cluster, subagents right-panel viewer, perf wave
  (turn-views, markdown-blocks push, deferred highlighting), sidebar restyle
  v0.11.1. Backfills: mcpToolLabel rendering, renameProviderEntry,
  mcp fixtures.
- **v0.10.0 → v0.11.0** (2026-10; SDK 1.0.0 → 1.1.0): the sidebar redesign chain
  (Sessions|Files, groups/pins/archive, ui-state store; new
  `pi:sessions:ui-state:*` + `pi:open-in-explorer:*` IPC), fork row menu
  (`pi:sessions:fork`), MCP project overrides, drag-drop uploads, CJK emphasis,
  custom font families. Backfills: 70470ca dialog/panel queues, DismissButton.
- **v0.9.3 → v0.10.0** (eb37814e, 2026-10; pi 1.0.0): MCP settings wave 2
  (add-pane flows, per-server exposure, catalog links), codemode takeover of
  built-in tools, tool descriptions on the wire. Fork divergence kept:
  `resolvedSdkPackageDir` resolves from the module location first (packaged
  Electron runs with cwd "/").
- **post-v0.9.1 → 0ff1138** (2026-09): themes + THEME_INIT_SCRIPT boot script,
  `pi:agent:lease` IPC, UTF-8 terminal locale, rich-text paste links,
  markdown-link rendering fixes, active-tool-events replay.
- **v0.9.0 waves** (2026-09; SDK 0.85.1 → 0.99.1): session search + windowed
  list + metadata cache (`sessionListVersion`), workspace terminal tabs
  (`pi:terminal:*`, node-pty in main), plugin update checks, Mermaid preview,
  chat width/font size, thinking-expand default; the MCP wave (ADR 0006,
  `pi:mcp:*`, 7 channels). Hotfixes found by manual testing: provider icons and
  catppuccin file icons under file:// (see Known upstream-compat notes).
- **v0.9.1** (2026-09): subagents P0 cluster (queue/resume/worktrees/profiles),
  provider usage quotas (`pi:provider-usage:query`), cascade delete, theme and
  language controls in Settings.
- **v0.8.9 → v0.8.11** (2026-08; SDK 0.84.3): FileViewer long-source perf,
  zh-TW locale, inline tool-result images over `pifile://`, `/clone` builtin,
  SVG CSP, session-reader cache + tail pagination, monotonic token counters,
  the built-in subagents cluster (ships dark, `isBuiltInSubagentsEnabled()`
  hard-false release gate) and the settings unification (SettingsPanel rollout,
  merged auth providers).

## External PR ports (not in upstream)

Changes pi-web never accepted, carried in this fork. Recorded here so drift against upstream stays
visible.

- **pi-web PR #548** — maximized file panel layout (commit `71baeed`). Later
  superseded by upstream's own `file-tab-state` parking at v0.12.0.
- **pi-web PR #45** — automatic session titles. Upstream rejected the PR and later shipped manual
  naming (`auto-name`) instead; this port keeps the PR's client-side trigger but **shares the
  manual path**: `sessionsAutoName` gained a `skipIfNamed` option (guard before `startRpcSession`),
  the hook fires it silently at `agent_end` (the upstream PR's placement, unlocked by #807's
  no-idle snapshot — the first completed turn names the session while retries/compactions continue;
  the `agent_settled`/no-stream paths remain as missed-event fallbacks, never bare
  `prompt_done`), skipping subagent sessions and in-flight duplicates. The PR's separate
  `generate-title` route with `completeSimple` was deliberately **not** ported. Contract guarded by
  `hooks/useAgentSession.auto-title.test.mjs`.

## Known upstream-compat notes

- Asset paths must stay document-relative under `file://`: upstream's
  `/provider-icons.svg#sym` and `/icons/catppuccin/...` resolve to the
  filesystem root in the packaged renderer (dev/e2e never saw it — they run on
  http://localhost). `FileIcons` pre-resolves the icons root with
  `document.baseURI`; guarded by `components/asset-paths.test.mjs` + packaged
  probes.
- `globals.css` `--font-mono` must not carry `var(--font-noto-mono)`. Upstream defines that variable
  via `next/font/google` in `app/layout.tsx`; that file died with the Next.js retirement (Slice 5),
  and a dangling `var()` invalidates the whole declaration. After every `globals.css` port, run
  `grep -c font-noto-mono pi-web/src/globals.css` and require 0.
- Upstream's own zh-TW locale is incomplete for the tools-panel keys; we completed ours and the
  registry test enforces parity — keep new keys translated in all three locales when porting.
- `rpc-manager.ts` tracks upstream minus `web-push.ts` (import and
  `notifySessionComplete` call site removed; the optional completion-callback
  constructor parameter is kept for API compat). `EXTENSION_REPORTED_CODE` lives
  in `lib/wire-codes.ts` so the renderer graph never reaches the main-side
  subtree.

## Lessons

- `git apply --3way` over a multi-file patch set is atomic — one file that
  can't apply rolls the whole batch back, and the per-file "cleanly applied"
  messages printed before the failure are misleading. Port commit-by-commit and
  file-by-file when the batch touches files the fork reshaped.
- `git apply --3way` and `git merge-file` can silently drop hunks when our
  context drifted while still reporting success — the port is only proven by
  the feature's own source-assertion tests landing in the same batch. Port
  tests with the code, and diff the merged file against upstream's for files
  the fork reshaped (ChatInput and rpc-manager especially).
- The renderer graph is a security boundary of its own — a helper imported by
  a component must not pull node-only SDK modules into it. The vite build
  catches this; the test runner does not.
