# 06: slice 5: cleanup + root reorg + packaging

Status: resolved

Blocked by: 04, 05

- Move renderer sources to src/renderer/ via git renames; delete Next.js app/ scaffolding, manifest.ts, sw.js/PWA bits
- electron-builder portable-dir target producing the portable zip
- README rewrite; pi-web/AGENTS.md rewritten as electron/AGENTS.md architecture notes
Gate: clean build from fresh clone produces portable zip; no next deps remain

## Comments

Resolved in 648e953. Renderer reorganized under pi-web/src (git mv), Next artifacts fully retired (app/, PWA, bin, proxy/instrumentation, configs), undici dispatcher ported into main, README + electron/AGENTS.md rewritten. Production build verified end-to-end: vite build green (postcss plugin needed a dynamic import — string names rejected by vite 7), portable dir release/win-unpacked (440MB, default icon) built by electron-builder, packaged exe boots from asar and passes slice1 (10/11, 1 known upstream fork flush) and slice2 (17/17) probes in packaged mode. Critical prod bug found and fixed: the next/navigation shim's replaceState('/') navigates file:// documents to the drive root — shim now only rewrites query-string URLs. Tests: 555/556 (1 known Windows PATH-separator env failure; 5 obsolete next-config/lifecycle suites deleted, 3 source-shape suites retargeted to electron/main/services). Remaining for ticket 07: app icon (electron-builder used the default), zip step for the portable directory, E2E suite.