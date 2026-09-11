# Issue 10: theme-controls-in-settings

Type: task
Status: resolved
Blocked by: 02

Port 2eb95b9 (#772): drop the toolbar theme + language selector buttons
(introduced by 448e146 one batch ago) so the chat chrome stays on the session;
keep the useTheme system-theme subscription mounted. Palettes and the Settings >
General radio group stay.

## Answer

Resolved. AppShell conflicts resolved keeping the fork's renderSidebarToggle;
mobile-toolbar test action list taken from theirs. Gate: typecheck +
mobile-toolbar/SettingsPanel suites green.
