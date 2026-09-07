# Issue 02: subagents-enable

Type: task
Status: open
Blocked by: 01

Port 237d0ca: isBuiltInSubagentsEnabled reads persisted settings (try/catch default false), SettingsPanel re-mounts AgentsConfig section (requiresProject), settings-navigation drops agents→general fallback, 3 test files. Update scripts-dev/packaged-probe.mjs gate check (was 'release gate off').
