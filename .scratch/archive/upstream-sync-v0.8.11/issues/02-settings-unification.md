# 02 — Port the settings unification cluster from pi-web

Status: resolved
Type: task
Upstream: `b6416c5`, `a8b68b1`, `a2deab3`, `c7b550a`, `b25ae6f`, `adae260`, `d2668e2`, `868b8b5`,
`4903dcb`, `c8de95e`, `081c5b1` (PowerShell toggle)

## What upstream built

A unified `SettingsPanel`/`SettingsUi` replacing the per-page config components (Models, Skills,
Plugins, Agents), with remembered navigation, preserved drafts across sections, standardized
sizing, direct settings shortcuts, and a Windows PowerShell tool toggle backed by
`app/api/tools/settings` + `lib/powershell-settings.ts`.

## Why deferred

- The cluster interleaves with the subagents cluster (AgentsConfig sections) — porting it first
  would create conflicts, porting it second inherits AgentsConfig.
- It reworks `app/settings.css` + `app/layout.tsx`, which map poorly onto our Vite SPA layout
  (`pi-web/src/globals.css`, `main.tsx`).
- The PowerShell toggle needs a new persisted tools-settings surface over IPC (`powershell-settings`
  lib itself is portable verbatim).

## Port plan sketch

1. After issue 01 (subagents), port `lib/settings-navigation.ts`, `lib/powershell-settings.ts`.
2. Add a `tools settings` typed IPC facade re-homing `app/api/tools/settings/route.ts`.
3. Port SettingsPanel/SettingsUi adapted to our layout (globals.css, no app/layout.tsx).
4. Port the Models/Skills/Plugins reworks; keep our transport changes (window.pi calls) intact.

## Answer

Done on branch `sync/pi-web-v0.8.11` (after issues 05 + 01).

- **SettingsPanel** (28bab3c) ported with the General section: theme preference radiogroup
  (useTheme from 28bab3c with `setThemePreference`), PowerShell shell-tool toggle (Windows-only),
  language picker. Models/Skills/Plugins render `embedded` inside it; AgentsConfig stays unmounted
  (upstream 96c643a release-disable — the component is carried as dark code, and
  `isBuiltInSubagentsEnabled()` is now hard-false, matching the upstream release gate).
- **AppShell** (c8de95e shape): bottom row is models + skills direct shortcuts + a Settings button
  (`getLastSettingsSection`); the four standalone config modals are gone; SettingsPanel bumps
  modelsRefreshKey / sessionKey on close/reload.
- **ModelsConfig / SkillsConfig / PluginsConfig** taken at 28bab3c and re-adapted to typed IPC
  (12 + 6 + 3 fetch sites; OAuth SSE → `IpcAuthLoginSource`). Also fixed a leftover fetch in
  `submitSelection` from the original fork (would have failed at runtime) and dropped the unused
  `URLSearchParams` baseUrl hint our catalog facade doesn't take.
- **Merged auth providers** (602b1b6, riding in): `authProviders()` service now returns
  `{providers, oauthProviders, apiKeyProviders}`; the separate all-providers channel remains for
  compat. ProviderIcon + `public/provider-icons.svg` ported.
- **Tools settings IPC** (081c5b1): `services/tools-settings.ts` + `pi:tools:settings:get/put`
  channels (win32-gated PUT), `ShellToolSettingsResponse` in api-types.
- **Tests**: upstream SettingsUi.test (14/14, css paths adapted, `main.tsx` stands in for
  app/layout.tsx) replaces the 10 issue-01 skips; ModelsConfig.test updated to the merged
  provider shape; settings-navigation/subagent-settings tests at 28bab3c.

Verification: typecheck clean; `npm test` 744 (742 pass, 1 skip, 1 pre-existing PATH failure);
`npm run test:e2e` 7/7.
