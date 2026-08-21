# 01: electron-vite scaffold + retire Tauri layer

Status: claimed

Blocked by: (none)

- electron-vite 3-target setup (main/preload/renderer), sandbox:true + contextIsolation + nodeIntegration:false
- Renderer boots current pi-web UI unchanged inside Electron (dev mode, any transport stubs allowed)
- Delete src-tauri/, scripts/prepare-desktop-runtime.mjs, scripts/copy-desktop-exe.mjs, old root package.json scripts
- Commit ADRs 0003/0004 + CONTEXT.md + this spec as first checkpoint
Gate: app window shows the UI; npm run dev works on Windows

## Comments
