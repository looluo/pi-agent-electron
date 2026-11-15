# App shell

The app opens a desktop window whose title contains "Pi", loads the preload bridge (`window.pi`), and renders the chat shell (sidebar with session list, chat pane) from a completely empty user-data dir.

## Sub-features

- `shell-open` — window opens with a "Pi" title and non-empty rendered text.
- `shell-bridge` — the preload bridge is exposed (sandbox + contextIsolation intact).
- `shell-facade` — `window.pi.sessionsList()` answers without error on an empty home.

## How to get to it (user POV)

- Launch the app; the window appears on its own. There is no other entry point — no CLI, no web URL, no HTTP port.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **Open the shell.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs shell`. The command prints `[ok] window opens`, `[ok] preload bridge exposed`, `[ok] app shell has content`, `[ok] sessions facade answers`, then `PASS` and exits `0`.
- **Proof.** The evidence dir printed at the end holds `shell.png` (window with app identity visible) and `facts.json` with the four steps and their timings.

## Gotchas

- An empty list from `sessionsList` is correct here — the staged agent home has no sessions.
- If the bridge check fails, the preload bundle is broken (sandbox/ContextBridge), not the shell.
