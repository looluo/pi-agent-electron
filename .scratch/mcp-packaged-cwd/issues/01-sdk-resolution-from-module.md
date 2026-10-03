# Issue 01: packaged app resolves the SDK from cwd "/", turning MCP off

Type: task
Status: resolved

Symptom: Settings › MCP in the packaged app showed "MCP 已关闭：Pi Web
无法加载 SDK 的 MCP 模块 … cannot locate @earendil-works/pi-coding-agent:
Cannot find package '@earendil-works/pi-coding-agent' imported from
/package.json".

Root cause: `importPiSdkInternals()` (pi-web/src/lib/pi-sdk-internals.ts)
verified the SDK copy via `resolvedSdkPackageDir(process.cwd())`, a check
written for the Next.js pi-web server (cwd = project root). Finder/Dock
launches run the Electron main process with cwd "/", where Node's resolver
finds no node_modules, so `loadPiSdkInternals()` always failed in packaged
builds and MCP stayed off (`internals-unavailable`). Dev builds were fine
(cwd = repo root).

Fix: resolve the SDK the way this module's own static import does —
`findPackageJSON(SDK_PACKAGE, import.meta.url)` (walks to repo node_modules
in dev/jiti, to app.asar/node_modules from out/main/main.mjs when packaged) —
keeping the Next.js cwd resolution only as fallback. The same-copy invariant
stays doubly guarded by the existing `createMcpExtension !== createMcpExtension`
identity check.

Verification:

- new `pi-web/src/lib/pi-sdk-internals.test.mjs`: internals load with cwd "/"
  (the packaged-app scenario); cached load matches; PI_PACKAGE_DIR still off.
- full `npm test`: 1707 pass.
- packaged `release/mac-arm64` launched via `open` (confirmed cwd "/"):
  Settings › MCP renders normally — no off-banner, "添加 MCP" enabled,
  code-mode card + sandbox "可用。" present.

## Comments
