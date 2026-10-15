# Issue 02: subagents-enable

Type: task
Status: resolved
Blocked by: 01

Port 237d0ca: isBuiltInSubagentsEnabled reads persisted settings (try/catch default false), SettingsPanel re-mounts AgentsConfig section (requiresProject), settings-navigation drops agents→general fallback, 3 test files. Update scripts-dev/packaged-probe.mjs gate check (was 'release gate off').

## Answer

Resolved in commit d2ad332. Ported 237d0ca across subagent-settings lib,
settings-navigation, SettingsPanel; imported upstream SettingsPanel.test.mjs
(css path remapped) and fixed the v0.8.11-sync drift it exposed: our
SessionSidebar still showed the fork glyph for child sessions instead of the
subagent robot glyph from baa600b. Electron subagents service shares the lib,
so the settings IPC is live without main-process changes. Probe wording
updated. Gate: typecheck clean, 761/763 unit (1 known baseline), new suites
17/17.
