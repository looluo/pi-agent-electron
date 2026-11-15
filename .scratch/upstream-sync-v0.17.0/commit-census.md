# Upstream commit census — v0.15.0 → v0.17.0 (`9416a058..174bff96`)

106 non-merge commits; 297 files +12,278/−1,517. **SDK wave: pi 1.5.0 → 1.5.2**
(e911f7bc; all eight `@earendil-works/*` exact-pinned; `pi-packages.test` green).
Executed as a file-level three-way merge (base 9416a058): 93 wholesale, 62 three-way
(22 conflicted, 55 hunks resolved by hand), 53 new, 8 fork-absent (all deliberate
omissions), 29 app/api re-homes; plus `app/globals.css`/`app/settings.css`/`provider-icons.svg`
mapped by hand. Helper: `scripts-dev/sync-classify.sh` + `sync-apply.sh` + `pick-hunks.py`.

Counts: **ported 88**, **n/a 16** (docs/demo/CI ×2, cli ×2, web push ×3, SSE auth
guard, PWA/README ×2, releases ×2 folded into the version bump), **deferred 0**.

| Theme | Status | Notes |
|---|---|---|
| SDK 1.5.2 (e911f7bc) | ported | mcp-sign-in, pi-sdk-internals (llamaCppExtension), transcript-notices-server adapted; npm --save-exact ×8 |
| llama.cpp built-in provider (47db4ef1) | ported | renderer llama UI wholesale; `pi:auth:api-key:set` gains serverUrl + catalog refresh; models-auth + modelsGet carry the extension factory; integration test re-homed onto the services (`lib/llama-cpp.integration.test.mjs`) |
| Test model like a chat request (7d6b4a16) | ported | modelsTest: getProviderAuthStatus + modelRuntime.completeSimple with fresh sessionId; probe test ported (`lib/models-config-test-route.test.mjs`) |
| built-in tools one-by-one (4ce18f38) + tools/settings route | ported | tools-settings service + `pi:tools:settings:put` gain `builtinTools`; service test ported (`lib/tools-settings-route.test.mjs`) |
| display-name editing (08989e75, 1c2ccec2) | ported | ProviderDetail lifted editingName (fork local state removed); fork's renames-ref bookkeeping replaced by upstream applyProviderRename |
| Agents strip (25eec16a, 1eb21f78) | ported | AgentMiniStrip + agent-strip-lock wholesale; AppShell DebugPanel import dropped (fork never carried the panel) |
| side-chat search (4cc85eb9) + multi-term (5f4cc884) + project names (454eccd7) | ported | sessionsSearch service drops the side filter; session-search-hit new |
| unread markers cross-window (bcf4f2ef) | ported | `pi:agent:running` gains `serverNow`; lib/unread-markers new |
| session_start dialog stream (7e2a1c1c, #1678/#1682) | ported | rpc-manager waitForStateRead; useAgentSession requestSlashCommands + withSessionStartStream; adapter fixture gained sessionsContext/sessionsGet options pass-through |
| bash: live output (550acf47), elapsed cards (4cd0ffa6), env guards (d66f8088, 58b8efa9, 94fd6e0f) | ported | liveOutputPreview, tool clocks, shellRunning fork guards |
| extension events: no-run message (fb436a3b), setEditorText (d3647418), load failure (6d9b7434), shutdown (49193522), keys (ef891cd4, ffabdb8e, 4a68a142), OSC (a1e1477e, 838a10dc) | ported | rpc-manager + useAgentSession + extension libs; onSessionEnded prop |
| ext message opens a run (01cfc8dc) | ported | message-display getTurnAnchors/hasTurnRef; session-reader countTurnsBefore rewrite; ChatWindow isMessageGroupAnchor retired |
| stopped-reply marking (c823f1bc, 6affd90f) | ported | isAssistantAborted; turn-views at upstream state; fork isProcessToolCall now accepts the raw AI-sdk `name` shape |
| markdown/files cluster (9268c566, 42a7aac2, 53c90497, 724c2b41, 4be8288a, 00fb65bc, dccf224d, fb4d0536, 23cdf941, 67ea0532, 2fd9d601) | ported | markdown.ts + FileViewer wholesale/3-way; pifile:// byte-range 416 fix (42a62f52) in files.ts with test |
| files: MIME (2c75eb89, b3f800c6), UTF-16 BOM (e713e902), previews (51217566), watch heartbeat (upstream watch wave) | ported | openFileWatch gains ping + IpcFileWatchSource readyState; useWatchRecovery widened to the IPC source |
| uploads: one 100MB limit (bae035ee), async writes + umask (e1df9241) | ported | files-upload.ts; limit tests ported (`lib/files-upload-route.test.mjs`) |
| npx env scrub (e00f359b) | ported | npxEnvironment via project-command-env (taken at upstream state); fork keeps RunNpxOptions.env for plugin-update proxies; skills service drops its own FORCE_COLOR |
| export private tempdir (4c476d4d) | ported | mkdtemp + hourly sweep in export.ts; source test ported |
| git: literal paths (67ea0532), trailing spaces (2fd9d601), empty added (4be8288a), untracked non-blocking (2e8d3b16) | ported | git-changes + services drop cwd/path trims; git-literal-paths.test wholesale |
| models: reasoning_levels/modalities (041df211), enabledModels trust (35fcc91a), auth.json reading (8a7db017) | ported | createEnabledModelsSettingsManager into models-enabled service |
| search pattern in grep cards (acb8fe61), emoji (dccf224d), token width (cb355b25), compaction retry (b96b28b9), queued-message restore (9f6d9a2f), composer focus (53c4f132), scroll (57cea50a), /copy fallback (649f8956), New-session seed (eeae1ea6) | ported | ChatWindow/ChatInput/useAgentSession 3-way; ChatInput keydown realigned to upstream (enterSendMode/acceptShortcut — a silently dropped hunk the new tests caught) |
| skills: keyboard guard (5746e801), root frontmatter (101295ca) | ported | SkillsConfig 3-way |
| i18n: tab summaries (059b1cf4), path hint (bb6bea1c), zh-TW push locale (a9978bfe message keys only) | ported | 3-locale manual merge, 127 dup keys removed per locale (re-added blocks superseded) |
| settings: pi-faithful settings read (8a7db017), dialog backdrop (66f01610), IME (edcde94e, 3ef3d83f) | ported | models-auth SettingsManager.create→createEnabledModelsSettingsManager family; SettingsPanel push section stripped (web push n/a) |
| a11y (685b0096), clipboard (5e3cd68e, 7e7c976b), notices (86cae7c6), mcp large ids (4cf04c34), mcp reconnect (9600172d), deferred tools (78aca7df) | ported | wholesale/small 3-way |
| copy rules (dc18951a, 773b42a2) | ported | settings/chat wording keys landed with the locale merge |
| sound once per completion (28e8852b) | ported | claimDoneChime over IPC (one window; the multi-page BroadcastChannel half is web form factor) |
| codemode stall (4935baf3) | ported | rpc-manager reload issue reporting |
| auth SSE controller guard (32437be8) | n/a | IPC push already try/catches gone receivers and aborts on destroy — same semantics, different transport |
| cli (58b8efa9 transport half, 33790c3d), web push subscribe (a9978bfe wire half) | n/a | no pi-web CLI, no web push |
| docs/demo/README/docker (8b64bfb0, 4c89be47, 7fa99ffc, a6a8ddbb) | n/a | upstream form factor |
| releases (97e411f3, 174bff96) | n/a | local version aligned 0.17.0 |

## Fork transport re-homes (new this sync)

- `pi:auth:api-key:set` body gains `serverUrl` (llama router) + `catalog` reply.
- `pi:tools:settings:put` body gains `builtinTools`.
- `pi:agent:running` reply gains `serverNow`.
- sessions context reply gains `leafId` (branchLeafId fallback).
- Preload ↔ main channel set unchanged otherwise; both sides updated in lockstep.

## Local-test adaptations

session-start-dialog/bash-command/idle-extension-message scripted onto the IPC
bridge adapter (which gained `sessionsContext` query + `sessionsGet` force
pass-through); llama + tools-settings + models-config-test + files range/upload
route tests re-homed onto electron services; ChatInput keydown sandboxes gained
`enterSendMode`/`submitsSlashCommandOnEnter`; fork-draft/send-recovery/pagination
expectations realigned (send-recovery's adapter deviation is obsolete now that
forced reads ride the bridge); npx test = upstream unit tests + fork's win32
Electron integration pair.

## Known fork notes carried forward

- `saveDefaultPreferences` in useAgentSession still calls `fetch("/api/models/default")`
  (pre-existing at v0.15.0, not a regression): the star-save has no IPC home yet.
- The session-reader anchor-rollback divergence stands (page extends to the turn
  anchor); upstream's mid-turn-cap test re-asserted our shape in its place.
- rpc-manager tracks upstream at 174bff96 minus web-push; `EXTENSION_REPORTED_CODE`
  moved to the new `lib/wire-codes.ts` so the renderer graph stays free of the
  main-side subtree (the vite build catches this; the test runner does not).
