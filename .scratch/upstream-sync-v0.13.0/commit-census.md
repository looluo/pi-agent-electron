# Upstream commit census — v0.12.2 → v0.13.0 (`b017cd4..upstream/main`)

99 non-merge commits. Conventions from `docs/upstream-sync.md`: `components/hooks/lib` → `pi-web/src/…`,
`app/globals.css|settings.css|sidebar.css` → `pi-web/src/…css`, `app/api/**` → `electron/main/services/`
behind typed IPC, `demo/ bin/ e2e/ docs/agents/ .github/ instrumentation-node.ts` → n/a.
SDK wave: pi 1.2.0 → **1.4.0** (`5c033d2`) — port first (type deps ripple into deferred-provider-models,
enabled-models-runtime, model-scope, pi-types).

Counts: **renderer 60** (10 of those test-only), **mixed 17**, **api-rehome 0** (none pure), **sdk 1**,
**n/a 21**. Dominant themes: Debug-panel/SSE-observability cluster (5 commits, web form factor),
usage-stats line SVG rework, markdown block features (svg/math/audio/fragment links), Models panel
feature run (base-URL override, adaptive thinking, image-size limit, provider searches), subagent
wait/completion semantics, hidden-page event-stream release + liveness refactor.

---

## 1. Commit table (newest → oldest)

| # | Sha | Subject | Class | Files (abbrev, `pi-web/src/`-mappable unless noted) | Port note |
|---|-----|---------|-------|------------------------------------------------------|-----------|
| 1 | `d128bae` | Release v0.13.0 | n/a | package.json, lock | align local version 0.13.0 |
| 2 | `0416353` | test(chat): read stats line past SVG arrows | renderer | MessageView.test | take with #5 `3383ba6` |
| 3 | `16f195c` | ci(release): npm Trusted Publishing | n/a | .github/workflows/publish.yml, docs/release.md, package.json | CI/npm publish — n/a |
| 4 | `ec9f38a` | feat(models): edit custom model's image size limit | mixed (api-rehome+renderer) | models-config route, ModelsConfig, **new lib/model-image-limits**, i18n×3, docs | route → existing models-config IPC (models-auth svc); new lib wholesale; i18n 3-locale merge |
| 5 | `3383ba6` | fix(chat): stats line arrows/clock as SVG | renderer | MessageView | wholesale |
| 6 | `f78c672` | fix(models): custom providers out of deferred cache (#1458) | renderer | deferred-provider-models(.test/.integration) | wholesale; after `5c033d2` (SDK types) |
| 7 | `6b8005d` | fix(codemode): PI_CODEMODE_MAX_WORKERS default 8 | mixed (portable lib + n/a boot) | instrumentation-node (n/a), **new lib/codemode-workers**, README/docs | take lib; call `applyCodemodeWorkerDefault()` from electron/main boot before first agent |
| 8 | `70e0ae7` | fix(chat): label tool card with patched file (#1460) | renderer | MessageView(+test), docs | wholesale; needs `246c1f2` patch lib state |
| 9 | `e368baf` | feat(debug): count SSE connections per page | mixed (api-rehome+renderer+server libs) | files route, terminal events route, DebugPanel(+state) **new**, FileViewer, TerminalPanel, useAgentSession, **new lib/page-stream-registry**, debug-snapshot/types **new**, page-debug | Electron: no SSE/pages; reduced form — connection counters over our push channel or skip; DebugPanel is new upstream UI |
| 10 | `3a01952` | feat(debug): list pages connected to server | mixed (api-rehome+renderer) | agent events route, agent-event-stream, **new lib/stream-client**, DebugPanel, i18n×3 | same decision as #9; agent-event-stream exists here (3-way) |
| 11 | `b5acfe8` | feat(debug): fold Debug panel into two columns | renderer (new files only) | DebugPanel, debug-panel-state, i18n×3 | take only if DebugPanel adopted |
| 12 | `02eee05` | fix(chat): give back a prompt the server never got (#1457) | renderer | AppShell, ChatWindow, useAgentSession, draft-store, **new hooks/send-recovery+retry-banner tests**, i18n×3 | 3-way — AppShell + hook reshaped; "server" = our main-process send path; tests ride along |
| 13 | `377c012` | feat(markdown): preview svg fences as image (#1455) | renderer | globals.css, MarkdownBody, MermaidBlock, **new SvgBlock(+test)**, i18n×3 | 3-way globals.css; new component wholesale |
| 14 | `8e766e3` | fix(chat): session folder gone, not "Model error" (#1453) | mixed (api-rehome+renderer) | agent/[id], agent/new, models routes, ChatInput, ChatWindow, useAgentSession, agent-client, **new lib/missing-cwd**, rpc-manager, i18n×3 | refusal shapes → agentNew/agentState/pi:models IPC; missing-cwd importers = agent-client+rpc-manager+hook; rpc-manager 3-way |
| 15 | `246e625` | fix(subagents): configurable wait budgets (#1448) | renderer | subagent-extension(.test/.integration), subagent-runtime(.integration), **new subagent-wait.test** | lib wholesale; check subagents.ts service settings surface (pi:subagents:settings) |
| 16 | `9ccde25` | fix(worktrees): name worktree holding branch (#1456) | mixed (api-rehome+renderer) | worktrees route, SessionSidebar, sidebar-actions(.test), worktree(.test), i18n×3 | route → workspace service IPC (worktree create path); libs exist here |
| 17 | `5e2d92d` | feat(markdown): copy button on math (#1380) | renderer | globals.css, MarkdownBody(+test), markdown.ts | 3-way globals.css only |
| 18 | `95d0c9d` | fix(files): download notice for binary files (#1401) | renderer | files/language route test, FileViewer(+test), text-preview(.test), i18n×3 | renderer wholesale; language-test hunk → our files-service language detection (pifile://) |
| 19 | `184a3f7` | fix(sessions): rename live session via AgentSession (#1451) | mixed (api-rehome) | sessions/[id] route, **new rename-route.test**, rpc-manager | route = our `pi:sessions:rename` (sessions.ts svc) — route through live AgentSession, no fresh SessionManager append; rpc-manager hunk 3-way |
| 20 | `91e1e17` | test(e2e): CDP targets in session navigation | n/a | e2e/session-navigation.mjs | upstream Next e2e harness |
| 21 | `db3c6c6` | fix(toolbar): mark folded More btn while subagents run (#1415) | renderer | AppShell, session-family(.test), i18n×3 | 3-way — AppShell toolbar reshaped (More button may not exist here) |
| 22 | `bb1e99e` | fix(chat): even stats-line gap under lists (#1449) | renderer | globals.css, MessageView(+test) | 3-way globals.css |
| 23 | `121c4b3` | fix(chat): pass attachments to pi uncompressed (#1442) | renderer | ChatInput(+test), demo, docs | **reverts our v0.8.11 9d7cd52 compression port** — delete compressImageFile path; 3-way ChatInput |
| 24 | `6c9dbbe` | feat(agents): subagent model+thinking depth in 3-row list (#1440) | mixed (api-rehome+renderer) | sessions/stats route(+test), AgentSessionPanel, session-reader, session-stats | stats route → sessionsGet stats (batch) IPC; renderer 3-way AgentSessionPanel |
| 25 | `ed3f8cb` | completion notify after group+parent finish (#1437) | mixed (api-rehome+renderer) | agent/running route, AppShell, ChatWindow, SessionSidebar, useAgentSession, rpc-manager, subagent-queue/runtime(.test/.integration) | agentRunning IPC payload + notification timing; rpc-manager+hook 3-way |
| 26 | `10318b6` | fix(chat): composer visible w/ long queued lists (#1429) | renderer | ChatInput(+test), ChatWindow | 3-way ChatInput (queue UI reshaped by `a295025`) |
| 27 | `0a0e72c` | fix(chat): HTML in user messages as text (#1444) | renderer | MarkdownBody(.test), MessageView, markdown(.test), slash-display(.test) | wholesale libs |
| 28 | `a295025` | feat(chat): queue prompts during compaction (#1426) | renderer | ChatInput(+test), ChatWindow, useAgentSession, chat-phase-label(.test), rpc-manager, **new rpc-manager-compaction-queue tests**, i18n×3 | feature commit — hook+rpc-manager+ChatInput all 3-way; port tests with it |
| 29 | `1fefdf0` | fix(chat): slash name matches, strip skill prefix (#1414) | renderer | ChatInput, **new ChatInput.slash-filter.test** | 3-way ChatInput (previously bitten by dropped hunks) |
| 30 | `f3bd2a7` | fix(tools): keep tool order on nav restore (#1405) | renderer | rpc-manager, rpc-manager-tool-exposure.test | rpc-manager 3-way (tool-presets interplay) |
| 31 | `fc08031` | fix(chat): shell command text not escaped JSON (#1396) | renderer | MessageView(+test), demo, docs | wholesale |
| 32 | `158e914` | fix(models): unavailable ≠ invalid (#1427) | mixed (api-rehome+renderer) | models/enabled route, enabled-models(.test/-runtime.test), i18n×3, adr/docs | route → models-enabled service (pi:models); libs exist |
| 33 | `80a61d7` | fix(models): models.json by name in sidebar (#1408) | renderer | ModelsConfig(+test), models-config-helpers | wholesale; our ModelsConfig keeps local editingName — verify |
| 34 | `dd250ba` | fix(files): changed files behind symlink (#1387) | renderer | git-changes(.test), paths(.test) | wholesale (realpath walk) |
| 35 | `b966404` | usage summary: precise detail + avg speed (#1417) | renderer | MessageView(+test), transcript-notices, i18n×3 | wholesale; pairs with #5/#22 stats-line work |
| 36 | `22f9eea` | fix(subagents): interrupted run not "running" (#1386) | mixed (api-rehome+renderer) | sessions routes ×2, rpc-manager, rpc-session-info.test, subagent-runtime, subagents.ts | sessionsList/sessionsGet liveness → sessions svc + rpc-manager 3-way |
| 37 | `7f883c7` | fix(chat): no scrollbar in empty composer (#1385) | renderer | ChatInput(+test) | small; 3-way ChatInput |
| 38 | `917d096` | fix(subagents): wait for reports, don't poll (#1384) | renderer | subagent-extension(.test), demo/mock | prompt-text change in shared lib; mock n/a |
| 39 | `444ac1c` | fix(models): translate sign-in/API-key prompts (#1383) | renderer | ModelsConfig, i18n×3 | 3-locale manual merge |
| 40 | `d97b8fd` | fix(chat): translate usage line/links/banner close (#1382) | renderer | ChatInput, MessageView, i18n×3 | i18n merge; component hunks small |
| 41 | `6a5c02f` | fix(extensions): open status/widget links in new tab (#1377) | renderer | AnsiText(.test), demo | target=_blank — verify Electron window.open policy for extension URLs |
| 42 | `3aeba55` | fix(files): translate upload counts/media errors (#1379) | renderer | FileExplorer, FileViewer, i18n×3 | 3-locale merge |
| 43 | `33490f4` | feat(cli): name interfaces behind wildcard bind (#1376) | n/a | bin/pi-web.js, bin/network-addresses.js, **new lib/network-addresses.test** | CLI only |
| 44 | `45ee42b` | test: finish Windows test fixes (#1364/#1366/#1368) | renderer (tests) | mcp route-add test (not carried), **new agent-phase+hidden-page-stream tests**, subagent-mcp integration | take only hunks for files carried; rides #28/#64/#71 |
| 45 | `166a2b3` | test: tolerate EBUSY in child cleanup (#1368) | renderer (tests) | builtin-extensions.integration (have), mcp-host.integration (new, not carried), mcp-read-only-policy.integration, subagent-mcp.integration | partial — carried files only |
| 46 | `1fce63c` | test(hooks): import react-hook-shim via file URL (#1364) | renderer (tests) | new-session-switch, useAudio, useGroupDrag, useResizablePanel, useSessionUiState, useSidebarMotion tests | all carried; jiti/pathToFileURL — matches our Windows notes |
| 47 | `d41c7b4` | test: stub USERPROFILE with HOME (#1366) | renderer (tests) | mcp/fork route tests (not carried), model-runtime.integration, rpc-manager-deferred-model.integration (new), session-fork.test | partial — carried files only |
| 48 | `c3d62dc` | test(mcp): marker files without touch (#1365) | n/a | mcp route tests (not carried) | n/a |
| 49 | `f2564df` | test(skills): bound fixture .agents by git root | renderer (test) | skills-service.integration.test | carried (win32 skip ×3 documented); adapt if our fixture roots differ |
| 50 | `6cbc6ef` | fix(chat): phone composer controls floating panel (#1421) | renderer | ChatInput | mobile CSS/menu — we keep the mobile-thinking-menu; verify applicability |
| 51 | `42bc3c7` | fix(toolbar): translate session stats tooltip (#1378) | renderer | AppShell | 3-way AppShell |
| 52 | `027d960` | test(skills): fixture out of dev profile (#1367) | renderer (test) | skills-service.integration.test | with #49; win32-isolation context |
| 53 | `98228f6` | fix(markdown): wrap long lines in code blocks (#1369) | renderer | globals.css, ChatWindow, MermaidBlock(.test), demo, e2e | 3-way globals.css (pre-wrap rules) |
| 54 | `f9d7173` | fix(sidebar): awaiting-input count separate when folded (#1423) | renderer | app/sidebar.css, SessionTree(+test), session-tree(.test) | 3-way sidebar.css; css remap app/→pi-web/src/ |
| 55 | `b593cd6` | refactor(liveness): one idle countdown; lease renewal resets (#1445) | mixed (api-rehome+renderer) | lease/events/debug routes, DebugPanel(+state), useAgentSession, agent-event-stream, debug-snapshot/types, rpc-manager, session-liveness(.test), i18n×3 | session-liveness **refactor 68+/81-** — we carry it (0ff1138 lease port); re-home onto pi:agent:lease; hook 3-way; debug-route hunks n/a unless DebugPanel adopted |
| 56 | `ed041ee` | feat(debug): read-only Debug panel (#1443) | mixed (api-rehome+renderer, 45 files) | debug/lease/events/files routes, DebugPanel(+state) **new**, AppShell, ChatWindow, FileExplorer, FileViewer, SessionSidebar, TerminalPanel, **new hooks/usePageHidden**, **new lib/file-version, file-watch-registry, page-debug, debug-types**, agent-event-connection/stream(.test), agent-event-wire, rpc-manager, session-liveness, subagent-runtime, terminal-manager, mcp-host, pi-types | **anchor of the wave** (9323+/88-): SSE/lease plumbing re-homed onto our push channel + lease IPC; file-watch-registry ≈ our IpcFileWatchSource; usePageHidden needed by #71; decide DebugPanel adoption or take libs only |
| 57 | `bce704c` | fix(markdown): Windows drive file links (#1355) | renderer | markdown(.test) | wholesale (win32-relevant) |
| 58 | `6d2c679` | fix(cli): open browser once first page served (#1363) | n/a | bin/pi-web.js, bin/browser-opener.js, instrumentation-node, **new lib/browser-opener.test** | CLI/Next only |
| 59 | `78a9f7c` | fix(models): refuse provider pi can't load (#1362) | mixed (api-rehome+renderer) | models-config route(+test), ModelsConfig, **new lib/model-provider-check(.test)**, i18n×3 | save refusal → models-config IPC; new lib imported by ModelsConfig only — wholesale |
| 60 | `d4849e4` | fix(push): announce runs, not handled commands (#1361) | renderer | rpc-manager, rpc-manager-command-completion.integration.test **new**, rpc-manager-shutdown.test | rpc-manager 3-way; our desktop-notification completion callback is the analog — keep semantics, strip push |
| 61 | `2b1c87c` | fix(sidebar): archived rows show last message time (#1351) | renderer | SessionTree(+test), session-tree(.test) | wholesale |
| 62 | `5c033d2` | chore(deps): pi 1.4.0 (#1346) | sdk | package.json/lock, deferred-provider-models, enabled-models-runtime, model-scope, pi-packages.test, docs | **port first**; adapter sweep + exact pins (all 7 pi packages); verify MCP_TYPESCRIPT_PREAMBLE-style export coupling |
| 63 | `17f104e` | fix(settings): name file when settings.json won't parse (#1349) | mixed (never-ported lib) | **new-ish lib/global-settings-file(.test)** — not carried here | our fork inlines settings.json IO (electron svc + local mcp-config-read/powershell-settings copies); port the `<path>: <parse error>` message shape wherever we parse it |
| 64 | `2b4ce6e` | fix(chat): keep tool phase on refresh resume (#1348) | renderer | useAgentSession, chat-phase-label(.test), **new agent-phase.test** | hook 3-way; lib wholesale |
| 65 | `14289bf` | fix(sidebar): spacer between project groups (#1344) | renderer | app/sidebar.css, SessionTree, session-tree(.test) | css remap; 3-way sidebar.css |
| 66 | `e533d9b` | fix(shortcuts): Ctrl+Alt+N by code, macOS (#1337) | renderer | useKeyboardShortcuts(.test) | wholesale — mac Electron relevant |
| 67 | `f7f8f45` | fix(models): symlinked models.json stays a link (#1336) | renderer | models-config-store, models-config route test | lib carried here (imported by electron models-auth svc); write-via-temp+rename preserving symlink |
| 68 | `71ee20c` | Session Info: merge Active Time over snapshot (#1340) | renderer | useAgentSession, rpc-manager, session-timing(.test), **new session-active-time/context-usage test hunks**, rpc-manager-shutdown/widgets tests | hook+rpc-manager 3-way (context-usage rides agentState IPC) |
| 69 | `3edded3` | fix(models): forget rename tracking on provider delete (#1342) | renderer | ModelsConfig(+test), models-config-helpers | our local editingName divergence — semantic port |
| 70 | `0fcc497` | fix(worktrees): transient git failures out of project cache (#1339) | renderer | worktree(.test) | wholesale |
| 71 | `70b2947` | fix(sessions): hidden pages release idle streams (#1328) | mixed (api-rehome+renderer) | lease route, files route, FileViewer, **new hooks/usePageHidden**, useAgentSession, agent-event-connection/stream, agent-event-wire, **new lib/file-version**, session-liveness(.test), subagent-runtime, **new hidden-page-stream.test** | Electron: "hidden page" = minimized/occluded window — adapt trigger (visibilitychange still fires); lease release → pi:agent:lease; hook 3-way |
| 72 | `7c0778a` | fix session search for renamed/generated titles (#1318) | renderer | SessionSearch, session-search(.test), demo | search over display names → our pi:sessions:search svc + lib wholesale |
| 73 | `408230c` | fix(chat): patch in one column on phone (#1325) | renderer | FileViewer, MessageView(+test), patch/apply-patch(.test) | mobile CSS + patch lib; verify max-panel interplay |
| 74 | `a26d85f` | test(e2e): settle sidebar toggle after breakpoint | n/a | e2e/run.mjs | upstream harness |
| 75 | `083fd11` | feat(chat): flat tool args as rows (#1324) | renderer | MessageView(+test), **new lib/tool-fields(.test)** | new lib imported by MessageView only — wholesale pair |
| 76 | `628d6ac` | fix(chat): steer/follow-up own row on phone (#1330) | renderer | ChatInput(+test) | mobile CSS; 3-way ChatInput |
| 77 | `2cefb72` | fix(markdown): fragment links after sanitizer prefix (#1323) | renderer | FileViewer, MarkdownBody, markdown, **new markdown-anchors.test** | wholesale |
| 78 | `bc762a3` | fix(chat): caret at quote end in Ask here (#1319) | renderer | ChatWindow, **new ChatWindow.quote-caret.test** | 3-way ChatWindow (quoted-branch is ours too) |
| 79 | `12b157d` | fix(chat): focus fresh composer after new session (#1313) | renderer | AppShell, ChatInput, AppShell.workspace-memory.test (carried), demo | 3-way AppShell — keep workspace-memory feature |
| 80 | `df163cd` | feat(models): match provider ids in searches (#1308) | renderer | ModelSelector, ModelsConfig(+test), models-config-helpers, ChatInput.test | wholesale |
| 81 | `35af710` | feat(terminal): follow chat font size (#1329) | renderer | TerminalPanel, useChatAppearance, ChatAppearance.test, i18n×3 | xterm fontSize from appearance prefs — our pi:terminal/xterm renderer; wholesale |
| 82 | `fbcbc31` | feat(agents): running subagents on Agents badge (#1311) | renderer | AgentSessionPanel, AppShell, session-family(.test), i18n×3 | 3-way AppShell toolbar |
| 83 | `962f1e8` | fix(settings): center general page column (#1310) | renderer | app/settings.css | css remap, 1-liner-ish |
| 84 | `6967ad6` | fix(settings): name font weights (#1309) | renderer | app/settings.css, FontSettings | wholesale |
| 85 | `5a2f991` | fix(sidebar): keep repo-root session after subdir (#1307) | renderer | SessionSidebar, new-session-context(.test) | 3-way SessionSidebar (tabs/file-search locals) |
| 86 | `cc041d8` | fix(models): mobile picker above keyboard (#1294) | renderer | globals.css, ModelSelector, e2e×2 | mobile CSS — 3-way globals.css |
| 87 | `4eed9e9` | fix(sessions): no system prompt in status reads (#1306) | mixed (api-rehome+renderer) | agent/[id] route, **new state-route.integration.test**, useAgentSession, agent-client, context-usage.test | agentState payload slimming → agent svc + hook 3-way |
| 88 | `f1b6d62` | fix(files): open PDFs from Android placeholder (#1305) | renderer | file-types(.test), request-security(.test) | mostly Android-web; request-security is shared — take lib hunks, verify PDF open path n/a |
| 89 | `246c1f2` | fix(chat): mark omitted lines between hunks (#1304) | renderer | FileViewer, MessageView, apply-patch/patch(.test), i18n×3 | wholesale libs + 3-way FileViewer |
| 90 | `f4adfd0` | fix(files): panel tabs 36px + wheel scroll (#1303) | renderer | globals.css, TabBar(+test) | 3-way — TabBar/max-file-panel locals live here |
| 91 | `3e4c175` | fix(sidebar): sync unread markers between tabs (#1292) | renderer | SessionSidebar(.test) | Electron single-window: cross-tab storage sync reduced/n-a — take the parse-hardening hunks at least |
| 92 | `1280e4f` | fix(models): trim Models form field notes | renderer | ModelsConfig, i18n×3 | i18n merge |
| 93 | `b8a3ffc` | fix(models): shorten footer open-session note | renderer | i18n×3 | i18n merge |
| 94 | `f0b3117` | feat(models): Claude adaptive thinking switch (#1331) | renderer | ModelsConfig(+test), models-config-helpers, i18n×3 | wholesale + pi-types/SDK 1.4 field check |
| 95 | `dd8201b` | feat(models): per-model Base URL override (#1288) | mixed (api-rehome test+renderer) | models-config route.test, ModelsConfig, i18n×3 | feature renderer; route test → models-config IPC test adaptation |
| 96 | `42909b6` | fix(skills): group .agents/skills under skills.sh | renderer | skill-lock(.test) | wholesale; electron skills svc benefits |
| 97 | `0347c5d` | fix(models): saved definitions to idle sessions (#1287) | renderer | ChatInput(+test), ModelSelector, ModelsConfig, pi-types, rpc-manager, **new rpc-manager-model-config.integration.test**, i18n×3 | rpc-manager 3-way; pairs with `f3bd2a7` |
| 98 | `a41c6f6` | test(e2e): distinguish repeated dialog results (#1285) | n/a | e2e/extension-dialog.mjs | upstream harness |
| 99 | `51b1159` | feat(chat): play markdown audio/video inline (#1280) | renderer | globals.css, MarkdownBody(+test) | wholesale; verify media served via pifile:// (MIME already ok for video per v0.9.0) |

Legend for the mixed api-rehome targets (no HTTP routes exist here; each maps onto existing typed IPC):
`agent/new|state|running|lease|events` → `pi:agent:*` (services/agent.ts, agent-events.ts); `sessions/…`
→ `pi:sessions:*` (services/sessions.ts); `sessions/stats` → sessionsGet stats; `models*` →
models-auth/models-enabled services; `files/…` → files.ts + `pifile://`; `terminal/[id]/events` →
`pi:terminal:*` push; `worktrees` → workspace.ts. New `agent/debug` route has **no IPC equivalent** —
needs a decision (skip vs `pi:debug:get`).

---

## 2. File-level summary (`git diff b017cd4..upstream/main --name-only`, 264 files)

### Mapped and HAVE (take 3-way or wholesale)

- **components** (all exist under `pi-web/src/components/`): AgentSessionPanel, AnsiText(+test), AppShell(+workspace-memory.test), ChatAppearance.test, ChatInput(.test), ChatWindow, FileExplorer, FileViewer(.test), FontSettings, MarkdownBody(.test), MermaidBlock(.test), MessageView(.test), ModelSelector, ModelsConfig(.test), SessionSearch, SessionSidebar(.test), SessionTree(.test), TabBar(.test), TerminalPanel, models-config-helpers.ts
- **hooks**: useAgentSession.ts, useChatAppearance.ts, useKeyboardShortcuts(.ts+.test), new-session-switch.test, useAudio.test, useGroupDrag.test, useResizablePanel.test, useSessionUiState.test, useSidebarMotion.test, retry-banner.test
- **lib** (all exist): agent-client(.test), agent-event-connection(.test), agent-event-stream(.test), agent-event-wire, apply-patch(.test), builtin-extensions.integration.test, chat-phase-label(.test), deferred-provider-models(.test), draft-store, enabled-models(.test/-runtime.test), file-types.test, git-changes(.test), i18n/messages ×3, markdown(.test), mcp-host(.test), mcp-read-only-policy.integration.test, model-runtime.integration.test, models-config-store, new-session-context(.test), patch(.test), paths(.test), pi-packages.test, pi-types, request-security(.test), rpc-manager.ts + rpc-manager-{idle-timeout,lifecycle,shutdown,tool-exposure,widgets,deferred-model.integration,session-info}.test, session-fork.test, session-liveness(.test), session-reader, session-search(.test), session-stats, session-timing(.test), session-tree(.test), sidebar-actions(.test), skill-lock(.test), skills-service.integration.test, slash-display(.test), subagents.ts, subagent-extension(.test/.integration), subagent-mcp.integration.test, subagent-queue(.test), subagent-runtime(.test/.integration), terminal-manager(.test), text-preview(.test), transcript-notices, worktree(.test)
- **css**: `app/globals.css` → `pi-web/src/globals.css`; `app/settings.css` → `pi-web/src/settings.css`; `app/sidebar.css` → `pi-web/src/sidebar.css` (all HAVE)

### New upstream files we DON'T have (all added inside this range) + importers

| New file | Pulled in by (upstream importers) | Needed here? |
|---|---|---|
| `components/SvgBlock.tsx`(+test) | MarkdownBody, MermaidBlock | yes — #13 |
| `components/DebugPanel.tsx`, `debug-panel-state.ts`(+tests) | AppShell | decision — DebugPanel adoption (#9/#10/#11/#55/#56) |
| `components/ChatInput.slash-filter.test.mjs` | — (test) | yes — #29 |
| `components/ChatWindow.quote-caret.test.mjs` | — | yes — #78 |
| `hooks/usePageHidden.ts` | FileViewer, useAgentSession | yes — #56/#71 |
| `hooks/agent-phase.test.mjs`, `compact-command.test.mjs`, `hidden-page-stream.test.mjs`, `send-recovery.test.mjs`, `session-active-time.test.mjs` | — | yes — ride #28/#64/#12/#68/#71 |
| `lib/tool-fields.ts`(+test) | MessageView | yes — #75 |
| `lib/model-image-limits.ts`(+test) | ModelsConfig | yes — #4 |
| `lib/model-provider-check.ts`(+test) | ModelsConfig | yes — #59 |
| `lib/file-version.ts`(+test) | FileViewer | yes — #56/#71 |
| `lib/file-watch-registry.ts`(+test) | files route, debug-snapshot, page-stream-registry | only for debug cluster — we have IpcFileWatchSource; likely skip or fold |
| `lib/page-debug.ts`(+test) | AppShell, DebugPanel, FileViewer, SessionSidebar, TerminalPanel, debug-panel-state | only with DebugPanel |
| `lib/page-stream-registry.ts`(+test), `lib/stream-client.ts`(+test) | files/terminal/agent events routes, debug-snapshot | SSE registry — no SSE here; skip unless debug re-home |
| `lib/debug-snapshot.ts`(+test), `lib/debug-types.ts` | agent/debug route, rpc-manager, DebugPanel, AppShell, ChatWindow, useAgentSession | partially — debug-types may ride rpc-manager hunks (#56) |
| `lib/missing-cwd.ts` | agent routes, agent-client, rpc-manager, useAgentSession | yes — #14 |
| `lib/codemode-workers.ts`(+test) | instrumentation-node only | yes, called from electron main — #7 |
| `lib/subagent-wait.test.mjs` | — | yes — #15 |
| `lib/browser-opener.test.mjs`, `lib/network-addresses.test.mjs` | bin/ CLI | n/a |
| `lib/global-settings-file.ts`(+test) | (upstream: cache-miss-notices route, codemode-settings, mcp-config-read, powershell-settings) — **our local copies of the latter two diverged and inline their own IO** | message-shape port only — #63 |
| `lib/mcp-host.integration.test.mjs` | — | n/a per v0.12.1 ledger convention |
| `lib/rpc-manager-{command-completion,compaction-queue×2,debug,model-config.integration}.test.mjs`, `lib/subagent-parent-completion.integration.test.mjs`, `lib/deferred-provider-models.integration.test.mjs` | — | yes — with their commits (#60/#28/#56/#97/#25/#6) |
| `app/api/agent/{debug,state,lease}-route.integration.test.mjs`, `app/api/files/watch-route.test.mjs`, `app/api/sessions/{rename,stats,fork}-route.test.mjs`, `app/api/models/route.test.mjs` | — | route tests → port as service-level tests where the service exists (rename→sessions svc, stats→sessionsGet, models→models-auth); skip watch/debug unless adopted |

### No mapping (n/a): `demo/**` (28 files), `bin/**` (3), `e2e/**` (8), `docs/**` (agents+adr+release), `.github/workflows/publish.yml`, `instrumentation-node.ts`, `AGENTS.md`, `README.md`, `package.json`/lock (SDK handling, #62).

---

## 3. Risk list — upstream delta vs our local drift

Upstream delta = `git diff b017cd4..upstream/main --stat -- <path>`; local drift = our file vs upstream base (changed lines, rough).

| File | Upstream delta (range) | Our drift vs base | Assessment |
|---|---|---|---|
| `hooks/useAgentSession.ts` | **653+/159-** (812 lines touched) | ~418 lines | **Highest risk.** Touched by 8 commits (#12 #14 #25 #28 #55 #56 #64 #68 #71 #87 = 10 commits). Carries PR #45 auto-title + local settle/stream flow. Port batch-by-batch with each feature's tests; consider file-level 3-way like v0.12.0 sync. |
| `lib/rpc-manager.ts` | **617+/32-** | ~161 lines | Tracks upstream at v0.12.1 state minus web-push. Touched by #14 #19 #25 #28 #30 #36 #55 #56 #60 #68 #97 (11 commits). Debug/liveness hunks (#55/#56) need our IPC shapes. |
| `components/ChatInput.tsx` | 127+/88- | ~78 lines | Touched by 9 commits (#14 #23 #26 #28 #29 #37 #40 #50 #76 #79 #80 #97 = 12). Prior silently-dropped-hunk victim. #23 deletes the compression we ported in v0.8.11 — remove `compressImageFile` and its callers. |
| `components/AppShell.tsx` | 167+/37- | ~446 lines | **Our most-diverged file** (maximized panel, workspace memory, terminal). Touched by #9 #12 #21 #25 #56 #79 #82. Take hunks semantically; #56 (DebugPanel mount + page-debug) gated on the debug decision. |
| `pi-web/src/globals.css` (upstream `app/globals.css`) | 107+/4- | ~135 lines | Touched by #13 #17 #22 #53 #86 #90 #99. PR #548 panel styles live here. After every port: `grep -c font-noto-mono pi-web/src/globals.css` must be 0. |
| `pi-web/src/lib/api-types.ts` | **0** — upstream unchanged this range | 0 (byte-identical to base) | No work. |
| `components/MessageView.tsx` (bonus) | 280+/44- | small | Stats-line SVG (#5 #2 #22), tool-card labels (#8), flat args (#75), HTML-as-text (#27) — mostly additive; new test files ride along. |
| `lib/subagent-runtime.ts` (bonus) | 226+/45- | — | #15 #25 #36 #56 #71 cluster; in-process subagent semantics — verify against our electron subagents service. |
| `lib/session-liveness.ts` (bonus) | 68+/81- (refactor) | — | #55 #56 rewrite idle countdowns; our lease port (0ff1138) sits on the old shape — real 3-way. |
| `lib/agent-event-stream.ts` (bonus) | 69+/8- | — | #10 #55 #56 — SSE page accounting; adapt to IPC push registry semantics. |
| `components/ModelsConfig.tsx` (bonus) | 121+/50- | editingName divergence | #4 #33 #59 #69 #80 #92 #94 #95 feature run; new libs (#4/#59) land first. |

### Suggested port order (drives the sync plan)

1. **SDK base**: `5c033d2` (pi 1.4.0) — everything type-adjacent depends on it.
2. **Pure-lib wholesale batch**: markdown/patch/tool-fields/file-types/skill-lock/session-tree/worktree/git-changes/paths + new libs (missing-cwd, tool-fields, model-image-limits, model-provider-check).
3. **Models feature run**: #4 #59 #94 #95 #32 #33 #69 #80 + i18n merges.
4. **Chat/message batch**: stats-line trio, HTML-as-text, queued-compaction (#28 + tests), slash filter, ChatInput mobile hunks, compression removal (#23).
5. **Subagent batch**: #15 #25 #36 #38 (rpc-manager + queue/runtime; tests ported with code).
6. **Session/liveness**: #71 #55 #64 #87 #19 #72 (+ session-liveness rewrite, agentState slimming, rename-through-AgentSession).
7. **Debug-cluster decision**: adopt DebugPanel reduced-form (single window, IPC push counters) or take libs only (#9 #10 #11 #55-debug #56) — decide before #12/#56 since usePageHidden/file-version ride it.
8. **i18n sweep + release align** (v0.13.0, local version bump), then verification gates (typecheck, npm test, e2e, packaged probe).

### Windows notes to carry into the port

- #44/#46/#47 (file-URL imports, USERPROFILE stubbing) match our existing jiti/pathToFileURL conventions — apply to carried test files only.
- #57 (Windows drive links), #34 (symlink), #18/#73 (phone/CSS) — verify under file:// renderer.
- skills-service.integration win32 skips stay documented (×3, v0.12.2 note); #49/#52 touch the same file.
