# 06: slice 5: cleanup + root reorg + packaging

Status: claimed

Blocked by: 04, 05

- Move renderer sources to src/renderer/ via git renames; delete Next.js app/ scaffolding, manifest.ts, sw.js/PWA bits
- electron-builder portable-dir target producing the portable zip
- README rewrite; pi-web/AGENTS.md rewritten as electron/AGENTS.md architecture notes
Gate: clean build from fresh clone produces portable zip; no next deps remain

## Comments
