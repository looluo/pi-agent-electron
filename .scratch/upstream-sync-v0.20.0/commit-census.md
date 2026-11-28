# Upstream commit census — v0.18.0 → v0.20.0 (`2daa0d13..ef517d7c`)

55 non-merge commits (spanning v0.19.0 `7b77aa1a` and v0.20.0 `ef517d7c`).
**SDK wave: pi 1.6.0 → 1.6.1 → 1.7.0** (ea36a8f9, 0de48724; all eight
`@earendil-works/*` exact-pinned via `npm install --save-exact`; the
`pi-packages.test.mjs` guard stays green). Executed as a file-level three-way
merge (base `2daa0d13`, tip `ef517d7c`): 129 wholesale (incl. `app/sidebar.css`
and `app/sidebar-menu.css` newly mapped in `scripts-dev/sync-classify.sh`), 60
three-way (32 merged clean, 28 conflicted files / 62 hunks by hand), 47 new (2
web-only `frame-ancestors` files dropped), 5 fork-absent (deliberate:
`DebugPanel*`, `open-in-file-manager*`), 55 `app/api/**` rows of which the
behavioral changes were re-homed onto Electron main services + typed IPC.

Counts: **ported 52**, **n/a 3** (frame-ancestors proxy middleware, Release
v0.19.0, Release v0.20.0) plus the usual docs/demo/e2e/compose/bin/AGENTS.md
rows.

| Theme | Status | Notes |
|---|---|---|
| SDK 1.6.1 (ea36a8f9) + SDK 1.7.0 (0de48724) | ported | all eight `@earendil-works/*` exact-pinned at 1.7.0; `pi-packages.test.mjs` green |
| Global HTTP proxy UI (46ae7469 #1811) | ported | new `electron/main/services/http-proxy.ts`, `pi:settings:http-proxy:{get,put}` IPC; `electron/main/index.ts` calls `configureHttpDispatcherFromSettings()`; `HttpProxyForm.tsx` re-homed onto `window.pi.httpProxy{Get,Put}` |
| Steering & follow-up queue modes (29654472 #1818, 7e9d663a #1819) | ported | new `electron/main/services/queue-modes.ts`, `pi:settings:queue-modes:{get,put}` IPC; `SettingsPanel.tsx` re-homed onto IPC (applies to live sessions via `applyQueueModesToLiveSessions`) |
| `notices.*` settings + transcript notices (pi 1.6.1, 8bae9eb0, 8070ef1a, be11335f) | ported | new `electron/main/services/notices.ts`, `pi:settings:notices:{get,put}` IPC; `electron/main/services/sessions.ts` (`sessionsGet` / `sessionsContext`) now calls `readSessionTranscriptNotices` + `attachTranscriptNotices`; `SettingsPanel.tsx` re-homed onto `window.pi.notices{Get,Put}` |
| File tree management: new folder, rename, move, delete, reveal (0ce50c52 #1838) | ported | `filesManage` added to `electron/main/services/files-upload.ts` + `pi:files:manage` IPC; `lib/file-manage-client.ts` re-homed onto IPC; `open-in-explorer.ts` extended for `{ reveal }` via `shell.showItemInFolder` with `isExistingFilePathAllowed` gate; `FileExplorer.tsx` menu download link uses `pifile://local/...` |
| Folder upload with subfolders (3288d545 #1786/#1840) + drop hint (a1e112ee) | ported | `electron/main/services/files-upload.ts` upgraded to `resolveManagedDirectory`, `validateUploadPaths`, `prepareUploadDestination`, relative `path` on `IpcUploadFile`; `FileExplorer.tsx` upload-check and `file-upload-client.ts` re-homed onto IPC |
| `#` session reference in composer (daf24fff #1801, bf81275e, 450471d6 #1837) | ported | `ChatInput.tsx` session catalogue fetch re-homed onto `window.pi.sessionsList()` |
| Slash-command argument completion (08250338 #1829) | ported | `useAgentSession.ts` `requestArgumentCompletions` dispatches `get_argument_completions` via `sendAgentCommand` → `pi:agent:command` |
| Sidebar date sort across projects + row sizing (03fc9ef9 #1822, 587940c8, 25425543) | ported | `app/sidebar.css` & `app/sidebar-menu.css` added to `sync-classify.sh` and synced wholesale |
| File link jump-to-line & wide split Git diff (1cea5e8d #1792/#1821) + large tracked Git diffs (3a03bdb7 #1789) + bare file links (6b5d6aae, 430e77e2) | ported | `FileViewer.tsx`, `git-changes.ts`, `file-links.ts`, `markdown.ts` ported; `workspace.ts` `isDiffPathAllowed` uses `hasParentDirectorySegment` |
| Oversize session single-entry read (5e52245a #1816) + paged view cache alignment (64553be3 #1836) | ported | `electron/main/services/sessions.ts` `sessionsThinking` & `sessionToolResultImage` switched to `readSessionEntryById`; `session-view-cache.test.mjs` wired to `installIpcBridgeAdapter` |
| Models bulk select/delete (685f17ac #1831), unresolved stored API key (6c49208f #1826), `input_modalities` & nested efforts (8a681588 #1820) | ported | `ModelsConfig.tsx` keeps fork `applyProviderRename` alongside bulk selection |
| Subagents: manual compaction wait (81988de0 #1798), package names in profile extensions (fc869ee0 #1802), default `subagent_type` gate (2161b858 #1833/#1839) | ported | `rpc-manager.ts`, `subagent-runtime.ts`, `subagent-extension.ts`; `subagent-package-scope.integration.test.mjs` isolates `HOME`/`USERPROFILE` from host `~/.agents/skills` |
| Chat & composer fixes: folded process cost sum (a78cb4f4 #1768), offscreen row stability (4b9f693a #1817), one scrollbar / skill quote (bad7ef35 #1825), end caret scroll (d8615c24 #1797), math normalization (c2b9423a #1782), fenced title (e037c606 #1781) | ported | `ChatWindow.tsx` keeps fork `ProcessDetailsGroup` persistence + `findFinalAssistantIndex` alongside `sumCost` |
| Offline update skip (`PI_OFFLINE`, 73acfdee #1828), merge-conflict file-index dedupe (00fa19bb #1772), submodule worktrees (a82b0423 #1795), MCP CLI env import (2509dbce #1794), skills ANSI strip (432366bd #1764), stored-choice hook (85ed1555, 979472b2) | ported | `models-auth.ts` `appUpdateStatus` honors `isPiOffline()`; `workspace.ts` `listWithGit` deduplicates `git ls-files`; `plugin-updates.ts` keeps `runNpm` with `isPiOffline()` |
| Refactors: shared `errorMessage`/`isRecord`, `thinking-levels`, `readJsonOrThrow`, `atomic-file` for `mcp.json`, MCP request helper, UI helpers (070f3778..6cea5533) | ported | Windows `renameReplacing` retry promoted into `lib/atomic-file.ts`; `mcp-bridge-fetch.ts` extended with `PUT /api/tools/settings` and wired as default on `saveMcpCodemodeMode` / `saveMcpCodemodeInlineBudget`; pre-existing bare fetches in `ChatWindow.tsx` (`appUpdate`), `ProjectTrustDialog.tsx` (`projectTrustGet`), and `useAgentSession.ts` (`agentState` / `sessionsContext`) re-homed onto IPC |
| Page framing CSP (`proxy.ts` / `lib/frame-ancestors.ts`, 23f318cd #1827) | n/a | Next.js web proxy middleware only; Electron loads `file://` without HTTP framing |
| Releases v0.19.0 (7b77aa1a) & v0.20.0 (ef517d7c) | n/a | local `package.json` & `package-lock.json` aligned to `0.20.0` |

## Fork transport re-homes (new this sync)

- `pi:settings:http-proxy:{get,put}` (`electron/main/services/http-proxy.ts`) + `configureHttpDispatcherFromSettings()` in `electron/main/index.ts`.
- `pi:settings:queue-modes:{get,put}` (`electron/main/services/queue-modes.ts`).
- `pi:settings:notices:{get,put}` (`electron/main/services/notices.ts`) + `readSessionTranscriptNotices`/`attachTranscriptNotices` in `electron/main/services/sessions.ts`.
- `pi:files:manage` (`mkdir`/`move`/`delete` in `electron/main/services/files-upload.ts`) + subfolder upload `paths` / `prepareUploadDestination`.
- `pi:open-in-explorer:post` extended to accept `{ cwd } | { reveal }` (`shell.showItemInFolder`) with `isExistingFilePathAllowed` gate.
- `mcp-bridge-fetch.ts` handles `PUT /api/tools/settings` (codemode mode & inlineBudget).
- `electron/main/services/sessions.ts` `sessionsThinking` & `sessionToolResultImage` switched to `readSessionEntryById`.
- `electron/main/services/workspace.ts` `listWithGit` deduplicates merge-conflict stages; `isDiffPathAllowed` uses `hasParentDirectorySegment`.
- `electron/main/services/models-auth.ts` `appUpdateStatus` honors `isPiOffline()`.
- Renderer bare-fetch cleanups: `ChatInput.tsx` (`#` sessions → `window.pi.sessionsList()`), `ChatWindow.tsx` (`appUpdate`), `ProjectTrustDialog.tsx` (`projectTrustGet`), `useAgentSession.ts` (`agentState`, `sessionsContext`), `FileExplorer.tsx` (menu download → `pifile://local/...`).

## Local-test adaptations

`SettingsPanel.test.mjs` (updated IPC guard to `noticesGet/Put`, `queueModesGet/Put`, `toolsSettingsGet/Put`, and `HttpProxyForm.tsx` `httpProxyGet/Put`), `hooks/session-view-cache.test.mjs` (`installIpcBridgeAdapter()`), `hooks/useSkipOffscreenRows.test.mjs` (`../globals.css`), `components/SessionTree.test.mjs` (`../sidebar.css` & `../globals.css`), `components/PiWebTitle.test.mjs` (`../../../node_modules/...`), `lib/http-dispatcher.test.mjs` (Windows parity `outcome` helper kept), `lib/subagent-package-scope.integration.test.mjs` (`HOME`/`USERPROFILE` isolated so host `~/.agents/skills` does not leak into SDK skill discovery).

## Verification

- `npm run typecheck`: clean (renderer + electron).
- `npm run build`: clean (main + preload + renderer).
- `npm test`: **3240 pass / 0 fail / 7 skip** (3247 total; +187 tests over v0.18.0; `pi-packages.test.mjs` green at 1.7.0).
- `npx playwright test` (E2E): **13/13 pass**.
- `verify-file-authorization`: **HOLDS** (seeds 20261115 ×3000 and 777 ×20000).
- App-drive journeys on built `out/`: `shell`, `session-history`, `terminal` **PASS**.
- `grep -c font-noto-mono pi-web/src/globals.css`: **0**.
