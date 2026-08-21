# Electron Host - Development Notes

## Architecture

```
Renderer (sandbox:true, contextIsolation, no Node)
  │  window.pi (contextBridge facade, electron/preload/index.ts)
  │  invoke-type calls + push subscriptions
Electron main (Node, ESM)
  ├─ services/agent.ts, agent-events.ts      sessions + agent command dispatch + event push
  ├─ services/files.ts, files-upload.ts      pifile:// protocol + watch push + uploads
  ├─ services/workspace.ts                   cwd/worktrees/git/file-index/project-trust
  ├─ services/models-auth.ts                 models/models-config/auth/app-update
  ├─ services/skills.ts, plugins.ts, export.ts
  └─ lib/ (pi-web/src/lib)                   rpc-manager + session-reader run IN main
```

**Three transports** (spec Q8): typed IPC facades for resources; one `pi:agent:command` dispatch channel mirroring rpc-manager's switch; `pifile://` custom protocol (standard+secure+fetch+stream+corsEnabled) for file GET traffic; push channels (`pi:agent-events:*`, `pi:file-watch:*`, `pi:auth-login:*`) replace all SSE.

## Key facts

- **pi SDK is ESM-only** → main builds as `.mjs` (`electron.vite.config.ts` main.output.format)
- **Vite define is build-only for client code** → `pi-web/src/main.tsx` installs a dev-only `window.process` shim; versions inject at build
- **file allow-list derives from session cwds** (`pi-web/src/lib/file-access.ts`) — a directory with no sessions needs `cwdValidate` (UI always does this) before files/skills/git IPC authorize it
- **prompt invoke returns after preflight**, not completion — consumers wait for `get_state` settle or event frames
- **OAuth login** streams identical frame payloads over `pi:auth-login:*`; manual code replies go through `authLoginCode`
- **Uploads** are typed byte arrays over IPC (per-file progress); conflict strategies: error/overwrite/skip
- **Export** runs pi CLI `--export`, patches deep-tree recursion iteratively, `shell.openPath`s the result
- **app-update** checks GitHub Releases `looluo/pi-agent2`; 404 (no releases) reports up-to-date

## Renderer

Forked pi-web v0.8.9 under `pi-web/src/` (ADR-0004). `next/navigation` is shimmed (`src/next-navigation.ts` — query-only replaceState; file:// documents reject absolute-path rewrites). Tests are `node:test` with jiti loading; `@/` alias imports of I18nProvider must match consumer imports (jiti module identity).

## Probes

`scripts-dev/slice{1..4}-probe.mjs` drive the real renderer over CDP (`--remote-debugging-port=NNNN`, `PROBE_PORT` env). `kill-dev.ps1` cleans stray dev processes.
