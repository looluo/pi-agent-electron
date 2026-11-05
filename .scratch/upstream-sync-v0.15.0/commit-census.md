# Upstream commit census — v0.14.1 → v0.15.0 (`v0.14.1..v0.15.0`)

28 non-merge commits. **SDK wave: pi 1.4.0 → 1.5.0** (ff8de361; all eight
`@earendil-works/*` exact-pinned, new `pi-schema`). Executed as a file-level
three-way merge (base v0.14.1): 32 zero-drift wholesale, 32 three-way
(27 conflict hunks), 9 new files; mcp-import* family taken wholesale after a
partially-resolved 3-way proved lossy (clientRegistration missing).

Counts: **ported 21**, **n/a 5** (Next.js 16.4.4/undici ad1b381b, docker aa4be54f,
CI 2bf9c6e5, docs 8c0646b0, two release commits fold into the version bump).

| Theme | Status | Notes |
|---|---|---|
| SDK 1.5.0 (ff8de361) | ported | npm --save-exact ×8 incl. new pi-schema; mcp-import* (clientRegistration/cimd validation, OAuth metadata URL), pi-sdk-internals, project-trust, subagent-extension adapted |
| models: reorder by drag/Alt+arrows/A–Z (6386fa43), provider names not ids (f6c86998), scoped-vs-all selector (14c0c947), signed-out enabledModels unmatched (7977dafa), mid-run model switch (7a815d15) | ported | modelsGet gains `scope:"all"`; loadModels ports providerName/isScoped/orderSelectorModels/withDeferredProviderModels; authProviders answers `providerNames`; pi:models IPC + preload carry scope |
| side: tabs restore with main session (5644bcfa), delete from Agents switcher (502cc16d), row height on delete-confirm (48a158bc) | ported | side-tab-state.ts new; deleteSideChat re-homed to `pi:sessions:delete` IPC; fork drops upstream's tab-session/SSR restore effect (web multi-tab form factor) |
| chat: streaming token/speed indicators (79425f8a), paste race (8d2fb36d) | ported | ChatWindow/ChatInput 3-way; stripAnsi |
| auth: device ID to OAuth (797d94b9) | ported | upstream's `createLoginOptions` (SettingsManager.create + flush) supersedes our v0.14.1 `getOrCreateInstallDeviceId` port — both kept, models-auth login switched to createLoginOptions |
| files: right-panel tab drag reorder (5e0e47f0) | ported | panel-tab-order.ts new; TabBar/FileExplorer |
| extensions: pi palette theme for extension UI (da6d538a) | ported | extension-ui-theme.ts new; AnsiText/status bar |
| notifications: one alert per completion (5f31fb64) | ported | browser-notifications wholesale |
| terminal: PowerShell before cmd on Windows (fff941a9) | ported | terminal-manager.ts 3-way; test's app/api SSE harness stripped, piSdkStub kept |
| export: drop pi-1.5-obsolete HTML patch (1fbf6c66) | ported | export.ts patchExportHtml deleted |
| sidebar: archive empty label off folded projects (b12b9082) | ported | SessionTree |
| mobile/settings cluster (57078bb5/9afc5084/1420b817/16153474) | ported | CSS + SettingsUi/settings.css; AppShell top-bar height var adopted; phone Agents-button icon hunk dropped (our renderFilePanelLayoutButton icons kept) |
| Next.js 16 + undici (ad1b381b), docker (aa4be54f), CI (2bf9c6e5), docs (8c0646b0) | n/a | web/infra form factor |

## Fork transport re-homes

- `GET /api/models?scope=all` (useAgentSession loadAllModels) → `window.pi.models(cwd, "all")`.
- `deleteSideChat`'s `DELETE /api/sessions/[id]` → `window.pi.sessionsDelete` (notFound → error).
- authProviders/login/export services carry the route deltas (providerNames, createLoginOptions, patch drop).
- **IPC clone audit**: get_tools allowlist (v0.14.1 fix) untouched; new get-mid-run paths return plain objects.

## Local-test adaptations

- extension-ui-theme.test: SDK import via `pathToFileURL` (win32 ESM scheme, #1364 family); globals.css path + CRLF→LF normalization.
- SettingsUi.detail-navigation.test: settings.css path.
- AppShell.side-tabs.test: effect-slice end anchor + `handleRightPanelClose` vm stub (fork deps).
- terminal-manager.test: piSdkStub re-added without upstream's app/api SSE import.
- model-loading.test: keeps the fork window.pi bridge, takes upstream's expanded case list.
- side-chat-client.test: rewritten for the IPC transports (fork/delete).
- ModelSelector.test.mjs: wholesale (ours was empty).

Verification: typecheck clean (renderer + electron); `npm test` 2680 = **2645 pass /
0 fail** / 35 skip; local version aligned 0.15.0.
