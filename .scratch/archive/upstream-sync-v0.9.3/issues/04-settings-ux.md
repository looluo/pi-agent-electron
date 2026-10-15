# Issue 04: settings-ux

Type: task
Status: resolved
Blocked by: —

197a3e5 (shared settings panel blocks + Plugins/Skills localization),
eceac13 (Enable all / Disable all, #1020), b9622a1 (group switches from
headings, #1021), 4de9f77 (switch sizing), 5df8278 (configurable send
key Enter/Ctrl+Enter, #1001).

## Answer

Resolved via wholesale component replacement (the four commits interlock
into one final shape; incremental 3-way merges produced Frankenstein
states) + transport rewiring:

- PluginsConfig / SkillsConfig / SettingsUi / settings-ui-helpers +
  tests taken from upstream HEAD; settings.css likewise (loaded at the
  renderer entry next to globals.css — the fork has no app/layout.tsx).
- Transport: 6 plugin fetches + 7 skill fetches rewritten to the typed
  bridge. The bulk PATCH /api/skills and bulk POST /api/plugins became
  new IPC: `pi:skills:bulk-toggle` (service skillsBulkToggle, one result
  per file) and packages-array enable/disable inside pluginsAction
  (services/plugins.ts gains upstream's setPackagesDisabled /
  setPackageListDisabled with keepEntrySettings filter protection and
  SettingsManager.drainErrors charging).
- api-types: +SkillToggleResult, +PluginToggleResult, +PluginsBulkResponse;
  ProjectTrustStatus gains optional decision/decisionPath/inherited/
  decisionError (populated by issue 09's trust work).
- Test adaptations for fork divergences: batch-toggle source assertion
  uses the IPC call; settings.css/globalCss paths mapped; McpConfig
  deferred to issue 09 (removed from configSources + two MCP tests);
  zh-TW locale keys aligned (web-auth/push keys our fork never had
  removed, agents.reloading added).

Gate: typecheck clean; npm test 1302/1304 (2 win32 skips, +33);
test:e2e 12/12.
