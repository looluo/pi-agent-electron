# Pi Agent App

Windows desktop app for the [`pi`](https://github.com/earendil-works/pi) coding agent. Electron host, forked pi-web UI, pi SDK in the main process — **no HTTP port** (ADR-0003).

Independently developed in [`looluo/pi-agent-electron`](https://github.com/looluo/pi-agent-electron) (ADR-0005). It began as a desktop line of `looluo/pi-agent2` and was split off once the Electron rewrite diverged beyond merging.

## Build

Prerequisites: Windows x64, Node.js ≥22.19, npm.

```bash
npm install
npm run build            # electron-vite build (main + preload + renderer)
npm run package:dir      # portable directory at release/win-unpacked/
```

`release/win-unpacked/` is the distributable: copy the folder, run `Pi Agent App.exe`. No installer, no WebView2 prerequisite (Chromium is bundled).

## Development

```bash
npm run dev        # electron-vite dev (renderer HMR at :5173)
npm run typecheck  # renderer + electron tsconfigs
npm test           # node:test suites under pi-web/src
```

Architecture notes live in [`electron/AGENTS.md`](electron/AGENTS.md); decisions in [`docs/adr/`](docs/adr/); vocabulary in [`CONTEXT.md`](CONTEXT.md).

## Layout

```
electron/           main process (services + IPC registration) and preload bridge
pi-web/src/         renderer (React SPA, forked from agegr/pi-web at v0.8.9, synced through v0.8.11)
out/                build output (main.mjs, preload.js, renderer/)
release/            electron-builder output (portable directory)
```

## Update checks

The app checks GitHub Releases (`looluo/pi-agent-electron`) and shows a notice when a newer version exists; upgrading means replacing the folder (spec: check + notify + manual replace).
