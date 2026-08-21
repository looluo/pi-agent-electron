# Spec: Electron IPC migration

Status: accepted

Rebuild Pi Agent App as an Electron desktop app: forked pi-web UI (v0.8.9) rendered in a sandboxed window, pi SDK running in the Electron main process, typed IPC instead of loopback HTTP, portable-directory distribution. ADRs 0003/0004 record the root decisions; this spec operationalizes them.

## Non-negotiables

- UI display and interaction behavior preserved (fork moves code, not pixels)
- No feature loss vs v0.8.9 except: browser/LAN access, PWA (manifest/sw), auto-update replaced by check+notify+manual-replace (ADR-0003 consequences)
- No listening port of any kind
- Gate: all 112 ported `node:test` files green; 7 Playwright Electron E2E specs green (launch, prompt+reply, tool call display, fork, session list/switch, auth settings page, window-close kills process)

## Architecture summary

| Concern | Decision |
|---|---|
| Host | Electron; SDK in main process; renderer sandbox+contextIsolation, nodeIntegration off |
| Repo layout | Root-level app: `src/renderer/` (moved from pi-web), `electron/` (main+preload), single package.json |
| IPC shape | Typed resource facades (sessions/files/models/auth/skills/plugins/worktrees); one `agent:command` dispatch channel mirroring rpc-manager's switch; push channels: per-session events, running, auth login |
| Window close | Kills app and in-flight runs (sessions persist in jsonl) |
| Distribution | Portable directory (unzip & run zip via electron-builder `dir`), no installer |
| Update | Check GitHub Releases (`looluo/pi-agent2`) via main-process handler; notify in ChatWindow UI (existing); `shell.openExternal` to download page. No in-app self-update |
| SSE → push | `agent:[id]:events`, `agent:running`, `auth:login` streams map 1:1 from the 4 SSE endpoints; files SSE folded into typed facade |
| OAuth | No local callback listener exists in pi-web (manual URL/code paste + device_code flows) — flows port to IPC unchanged |

## Slices (implementation order, each ends runnable+committable)

0. **Scaffold** — electron-vite 3-target setup; commit docs; delete `src-tauri/`, prepare/copy scripts, old root scripts
1. **Agent+Sessions** — port `rpc-manager`, `session-reader`, agent/sessions routes → main; rewrite `agent-client` + `useAgentSession` transport; SSE→push
2. **Files/Git/Cwd/Worktrees** — file access allow-list, file-index, git status/diff, cwd validate/browse, worktrees
3. **Models/Auth/Update** — models, models-config CRUD/test/discover/catalog, provider auth (test each provider live), app-update → GitHub Releases handler
4. **Skills/Plugins/Export/Misc** — skills CRUD+install+search, plugins CRUD, session export (shell.openPath), home route, PWA removal
5. **Cleanup** — delete Next artifacts, root reorg (git renames), portable zip packaging, README rewrite, pi-web/AGENTS.md rewrite
6. **Verification** — unit tests green; E2E suite; manual auth matrix

## Facts established (do not re-litigate)

- Renderer has zero SSR dependencies (no cookies()/headers()/"use server"/middleware) — Vite migration is mechanical
- No native modules anywhere (proper-lockfile, js-yaml, undici, pi packages are pure JS) — no electron-rebuild
- Electron ≥39 embeds Node ≥22.20 ≥ pi-web's `>=22.19` requirement
- OAuth login routes have no local HTTP callback listener
- Change surface: 40 routes (~3.7k LOC) → main services; 64 fetch sites (13 files); 6 EventSource sites (3 files); useAgentSession.ts (1949 LOC) is the hardest single unit

## Retirement list

`src-tauri/` (all), `scripts/prepare-desktop-runtime.mjs`, `scripts/copy-desktop-exe.mjs`, root package.json old scripts, `manifest.ts` + sw.js + PWA bits, README (rewritten), `pi-web/AGENTS.md` (rewritten).

Survives with source swap: `lib/app-update.ts` version comparison + ChatWindow update notice — npm source replaced by GitHub Releases IPC handler.
