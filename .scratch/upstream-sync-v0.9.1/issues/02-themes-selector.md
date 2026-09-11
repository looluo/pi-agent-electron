# Issue 02: themes-selector

Type: task
Status: resolved
Blocked by: 01

Port 448e146: lib/theme.ts + ThemeIcon + useTheme rework (5 palettes: light/dark/mist/
rose/pine), toolbar theme selector menu (keyboard nav, shared selection-menu layer with
language menu), SettingsPanel radio labels, accent-contrast sweep, settings.css/globals.css
palettes. index.html gains the THEME_INIT_SCRIPT boot script (fork never had one — pre-548
FOUC gap now closed); kept in sync by a theme.test.mjs guard. PWA standalone block and
web-login styles from the same upstream hunks dropped (n/a per ledger).

## Answer

Resolved. AppShell ported by hand against the PR #548 layout (renderThemeButton reworked
in place; renderSidebarToggle untouched). font-noto-mono guard: 0. Gate: typecheck +
theme/mobile-toolbar/SettingsPanel suites green.
