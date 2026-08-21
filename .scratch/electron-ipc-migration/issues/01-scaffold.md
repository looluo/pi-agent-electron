# 01: electron-vite scaffold + retire Tauri layer

Status: resolved

Blocked by: (none)

- electron-vite 3-target setup (main/preload/renderer), sandbox:true + contextIsolation + nodeIntegration:false
- Renderer boots current pi-web UI unchanged inside Electron (dev mode, any transport stubs allowed)
- Delete src-tauri/, scripts/prepare-desktop-runtime.mjs, scripts/copy-desktop-exe.mjs, old root package.json scripts
- Commit ADRs 0003/0004 + CONTEXT.md + this spec as first checkpoint
Gate: app window shows the UI; npm run dev works on Windows

## Comments

Resolved: scaffold complete (commit pending). Electron 39.8.10, three-target electron-vite build green (3491 renderer modules), dev boots clean (0 errors, renderer 200, 4 electron processes). Tests: 581/584 pass — 3 known failures: two app/api route tests awaiting slice 1–2 port (next/server retired), one pre-existing Windows PATH-separator assertion. Findings recorded: Vite 7 applies `define` only at build for client code (dev gets a runtime process shim in src/main.tsx); jiti treats `@/`-alias and relative imports of the same module as two instances (test files now import I18nProvider via alias).