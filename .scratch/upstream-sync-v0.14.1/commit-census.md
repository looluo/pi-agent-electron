# Upstream commit census — v0.13.0 → v0.14.1 (`d128bae..v0.14.1`)

23 non-merge commits. SDK stays 1.4.0 (no dependency wave). Executed as a
file-level three-way merge (base d128bae): 22 zero-drift files taken wholesale,
24 three-way merged (19 conflict hunks resolved), 10 new files landed,
SubagentViewer + subagent-viewer-state deleted (replaced by SessionChatPanel).

Counts: **ported 19**, **n/a 4** (docker e97d00b1, PWA manifest b54a63d9, two
release commits), plus docs/AGENTS/demo/e2e rides n/a.

| # | Sha | Subject | Class | Notes |
|---|-----|---------|-------|-------|
| 1 | `3bad742d` | feat(side): side chats forked from the current session (/side) (#1469) | anchor | see below |
| 2 | `0b1eeffa` | feat(tab): badge the favicon while sessions need attention (#1484) | ported | favicon-badge lib wholesale; **desktop adaptation**: badge dataURL → `pi:window:set-taskbar-badge` IPC → `BrowserWindow.setOverlayIcon` |
| 3 | `5269cb0d` | Fix sandboxed HTML preview storage (#1494) | ported | html-sandbox-polyfill lib + FileViewer hunks; e2e n/a |
| 4 | `6d0946b1` | feat(chat): "Quote" inserts just the selected text as a blockquote (#1502) | ported | askSelectionHere → quoteSelectionHere rename rode the 3-ways; quote-caret test kept fork guard (no demo/) |
| 5 | `b25fa0aa` | fix(chat): custom message text layout as pi's TUI | ported | markdown.ts + MarkdownBody + globals.css |
| 6 | `2251c3fa` | feat(files): View as Tree / List for Git changes panel (#1490) | ported | FileExplorer + sidebar-prefs wholesale |
| 7 | `f07f3682` | feat(file-viewer): wrap prose files by default (#1471) | ported | file-viewer-state wholesale |
| 8 | `c319c850` | fix(tools): keep the carried tool order (#1481) | ported | rpc-manager + tool-exposure test |
| 9 | `98ad3908` | fix(subagents): settle a cut-off child's run when a turn in its chat ends (#1473) | ported | onDirectTurnSettled + SUBAGENT_CONTROLLER.settleDirectTurn |
| 10 | `6fbb36b5` | fix(subagents): list the session's latest subagents when an id finds nothing (#1491) | ported | subagent-extension wholesale |
| 11 | `7b5cd68d` | fix(chat): preserve skill search ranking across dormancy (#1497) | ported | ChatInput hunk |
| 12 | `cb3cebef` | fix(chat): keep message's actions on screen on narrow phones (#1487) | ported | MessageView + globals.css |
| 13 | `4bb6d2f8` | fix(models): localize provider authentication feedback (#1496) | ported | authLoginCode IPC keeps transport; error message localized with result.status |
| 14 | `62650652` | fix(models): localize shared model selector labels (#1495) | ported | i18n merge |
| 15 | `15c52bbb` | fix(models): keep the shared extension runtime for an hour (#1500) | ported | model-runtime wholesale |
| 16 | `c6789c5d` | fix(models): preserve provider picker during IME Escape (#1499) | ported | 1-liner |
| 17 | `2b7c4033` | fix(sidebar): pin on an empty project's group (#1492) | ported | sidebar.css wholesale + SessionTree |
| 18 | `c2ef9a5d` | fix(files): disable directory selection while navigating (#1498) | ported | DirectoryPicker |
| 19 | `2621aa10` | fix(directory-picker): keep picker open when a text drag ends outside (#1462) | ported | DirectoryPicker |
| 20 | `e97d00b1` | feat: docker support (#1478) | n/a | Docker/web form factor |
| 21 | `b54a63d9` | fix(pwa): credentials on manifest link (#1477) | n/a | PWA; no manifest in the desktop fork |
| 22 | `0de01503` | Release v0.14.0 | n/a | version aligned 0.14.1 locally |
| 23 | `506168bf` | Release v0.14.1 | n/a | ditto |

## 3bad742d (side sessions, ADR 0007) — port decisions

- **Renderer**: SubagentViewer + subagent-viewer-state deleted; SessionChatPanel
  (new) hosts a side chat in ChatWindow's `panel` mode; AppShell gains side
  tabs (`sideChatTitle`), `handleSideSession` → `createSideChat`; quote button's
  ask-in-new-chat guard replaced by `onSideSession` + `isHiddenRelation`.
- **Transport re-homes**: `createSideChat`'s `POST /api/sessions/[id]/fork` →
  `window.pi.sessionsFork(id, { side, name })` (preload + ipc + service wired);
  SessionChatPanel's `GET /api/sessions/[id]` → `window.pi.sessionsGet`
  (notFound shape). `sessionsFork` service ports the route's side semantics
  (createSideSession, `{ kind: "side" }` relation, sideChatNameFromText).
- **sessionsGet**: `sideOwnEntries` bounds stats/totalActiveMs;
  `readSideRelation` adds the side relation. **sessionsSearch** filters
  `relation.kind === "side"`.
- **Latent v0.13.0 bug fixed en route**: AgentSessionPanel's
  `fetch("/api/sessions/stats")` never worked under file:// (silent
  "Failed to fetch"); ported the stats route as `pi:sessions:stats`
  (services/session-stats.ts, WeakMap summary cache incl. sideOwnEntries)
  and switched the panel to the IPC.
- **rpc-manager**: nameSideChat/refuseForkOfSideChat landed; upstream's
  `notifySessionComplete` web-push wiring **stripped** (no push channel; fork
  keeps its completion-notification analogs).
- DebugPanel wiring from the upstream side of merges stripped again (v0.13.0
  decision stands); page-debug shim covered `startPageVisibilityTracking`.

## Local-test adaptations

- MessageView.test.mjs css path `../app/globals.css` → `../globals.css`.
- side-chat-client.test.mjs rewritten against the IPC transport (window mock).
- zh-CN/zh-TW: enterSendMode keys deduped (fork already carried them).
