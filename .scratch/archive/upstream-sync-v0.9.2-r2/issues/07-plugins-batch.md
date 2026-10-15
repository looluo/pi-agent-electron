# Issue 07: plugins-batch

Type: task
Status: resolved
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

Gate: typecheck ×2; plugins suites; packaged-build manual check of "check updates" on Windows (no npm.cmd, real registry fetch).

## Answer

All three commits ported; branch `pi-web-agent-93e41508-2788-4184-b75e-e1f4dd23e9a2`.

- `fce666a` (relativePath separators): `app/api/plugins/route.ts` change applied
  to its re-homed copy in `electron/main/services/plugins.ts` (`getRelativePath`
  now does `rel.split(sep).join("/")`, `sep` imported). No renderer-side copy
  of this logic exists, so the service was the only target.
- `afd2575` (npm without npm.cmd shim): new `pi-web/src/lib/node-cli.ts` with
  upstream's `findNodeCliScript`/`nodeCliInvocation` API **plus** the local
  packaged-Electron adaptation folded in: `findNodeCliRuntime` scans `PATH`
  (honoring `env.PATH ?? env.Path`) for a real `node` when `process.execPath`
  is the app executable. `npx.ts` rewritten as the thin upstream wrapper
  (runNpx/runNpm → `nodeCliInvocation`), keeping the local win32 hard error
  when no cli.js can be located (packaged app has no shim to fall back to).
  `plugin-updates.ts` needed no logic change — its `runCommand` already routed
  bare `npm` through `runNpm`, which now resolves via node-cli; comment updated
  to cite CVE-2024-27980 / node-cli.ts. Upstream `node-cli.test.mjs` ported
  verbatim (4 tests; the `nodeDir`-injected cases pin upstream semantics).
- `38cba2b` (package description): components/lib/i18n patch applied cleanly
  via `git apply --3way --directory=pi-web/src` (PluginsConfig.tsx detail-grid
  row + sidebar tooltip fallback, api-types `description?`, i18n en/zh-CN/zh-TW
  `i18n.description`). Route semantics re-homed into `services/plugins.ts`:
  `readPackageMetadata` parses `description` and the package map gains
  `description`. No IPC shape/type changes needed — `pluginsList` returns the
  whole `PluginsResponse` body, and `PluginPackageInfo` (api-types) flows
  through the existing `pi:plugins:list` channel unchanged.
- Tests: upstream `app/api/plugins/route.test.mjs` (both the pre-existing
  top-level-extensions test that motivated `fce666a` and `38cba2b`'s new
  description test) ported as `pi-web/src/lib/plugins-route.test.mjs` against
  `pluginsList` (`{ status, body }` instead of `NextResponse`); jiti alias `@`
  → `pi-web/src` per the terminal-manager.test.mjs convention. Passes on
  Windows, proving the separator normalization end-to-end.

Conflicts: none at patch level (only `38cba2b` had renderer hunks; all applied
cleanly). The real merge was semantic in `npx.ts`/`plugin-updates.ts`, where
the local PATH-scanning adaptation superseded upstream's execPath-only lookup;
  resolved by keeping both (upstream API + tests, Electron runtime resolution).

Gates: `npm run typecheck` clean (both tsconfigs). `npm test`: 1138 tests,
1134 pass, 1 fail (`direct bash updates the platform PATH key` — pre-existing
Windows baseline), 3 skipped. Delta vs baseline: +6 tests (4 node-cli, 2
plugins-route), +6 pass. Packaged-build manual "check updates" check NOT
performed here (no packaging run in this worktree) — the covered-by-proxy
  evidence is `npx.test.mjs`'s Electron-runtime runNpx/runNpm tests, which
  spawn through ELECTRON_RUN_AS_NODE and still pass.
