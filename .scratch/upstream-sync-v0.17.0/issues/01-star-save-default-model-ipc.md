# Star-save of the default model/thinking level has no IPC home

Status: needs-triage
Found: 2026-11-15, during the v0.17.0 upstream sync (cross-model review flag)

## Problem

`saveDefaultPreferences` in `pi-web/src/hooks/useAgentSession.ts` (~line 2870)
still sends `fetch("/api/models/default", { method: "PUT", ... })` — upstream's
HTTP route. Under Electron the renderer loads from `file://`, so the fetch has
no server to reach: the star ("save as default") on the model and reasoning
selectors throws "Failed to fetch" and the default is never persisted.

Pre-existing at v0.15.0 (upstream code carried over), not a regression of the
v0.17.0 sync; the sync explicitly left it untouched and recorded it in the
census ("Known fork notes carried forward").

## What a fix needs

- An electron service port of upstream `app/api/models/default/route.ts` (the
  logic is the pure lib `writeDefaultPreferences` + `lib/default-preferences.ts`
  parse/allow-list checks, both already in the tree).
- A `pi:models:default:put`-style channel in `electron/main/ipc-models-auth.ts`
  plus preload and `lib/pi-ipc.ts` types.
- `saveDefaultPreferences` switched onto `window.pi`.
- The llama-cpp integration test already writes defaults through
  `writeDefaultPreferences` directly and can serve as the service-level guard.

## Comments
