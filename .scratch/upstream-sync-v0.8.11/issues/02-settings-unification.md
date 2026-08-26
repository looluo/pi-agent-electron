# 02 — Port the settings unification cluster from pi-web

Status: open
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
