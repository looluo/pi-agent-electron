# Plugins

Settings › Plugins lists the configured plugin packages and switches each one on and off; the per-package switch sends the single-package request form over `pi:plugins:action`, and the panel re-renders from the answer.

## Sub-features

- `plugins-list` — Settings › Plugins renders a package configured in the staged home's `settings.json`, by its package name.
- `plugins-disable` — the per-package switch ("禁用包"/"Disable package", a `role="switch"` button in the selected package's detail) flips the package off: the switch's accessible name flips to the enable action, and `window.pi.pluginsList(null)` reports `disabled: true`.
- `plugins-enable` — switching it back on restores the state.

## How to get to it (user POV)

- Open a project (the Plugins section needs one), then sidebar footer → Settings (设置) → the Plugins (插件) section tab → click a package row → its detail header holds the switch.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **Switch round trip.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs plugins`. The driver stages one package (`verify-plugin-pkg`) configured in the isolated home's `settings.json` plus one fixture session (the Plugins section requires an open project), opens the session, opens Settings › Plugins through the real UI, selects the package, disables it via the switch, confirms the flip through the facade (`pluginsList` with the project cwd), re-enables it, and prints `[ok] opened the project session`, `[ok] opened Settings`, `[ok] opened the Plugins panel`, `[ok] selected the staged package`, `[ok] package disabled`, `[ok] package re-enabled`, then `PASS`.
- **Proof.** Evidence holds `plugins-panel.png` (the panel with the package visible) and `facts.json`.

## Gotchas

- The Plugins section is disabled until a project is open (`settingsSectionRequiresProject`); the journey opens a fixture session first — a `Timeout` on the 插件 tab click usually means no project got selected.
- `window.pi.pluginsList(null)` answers `400 cwd required` — always pass the project cwd.
- The switch's accessible name is its current action (禁用包 when enabled, 启用包 when disabled) — waiting for the name flip is the state assertion; the facade check pins it server-side.
- This journey exists because the single-package form once died behind the bulk form's gate ("packages must be a list of {source, scope}", fixed at the v0.18.0 sync): a green run proves both request forms reach the service.
- The staged `settings.json` replaces the copied one, so the panel shows exactly one package — user-installed packages never appear.
