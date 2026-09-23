# Issue 07: plugins-batch

Type: task
Status: ready-for-agent
Blocked by: —

Three plugin commits, independent of the rest (can run in parallel with
02–06). Local base: plugin-updates + npx.ts already ported; plugins IPC lives
in `electron/main/ipc-skills-plugins.ts` / `services/plugins.ts`.

- `fce666a` — normalize relativePath separators for Windows (#827):
  plugins route path handling. Windows-first for us; check the same
  normalization is applied on the Electron service side, not just the
  renderer copy of the route logic.
- `afd2575` — run npm update checks without the npm.cmd shim on Windows
  (#837): new `lib/node-cli.ts` + npx.ts/plugin-updates.ts. Directly
  relevant — our packaged app launches plugins/npm without a shell.
- `38cba2b` — show package description in the Plugins panel (#868):
  plugins list shape gains description; PluginsConfig UI + i18n ×3.

Gate: typecheck ×2; plugins suites; packaged-build manual check of "check
updates" on Windows (no npm.cmd, real registry fetch).
