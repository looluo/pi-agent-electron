# Terminal

The app hosts workspace terminals (xterm.js in the renderer, node-pty in the main process) over typed IPC: create a terminal, subscribe to its output stream, write a command, read the echoed output.

## Sub-features

- `terminal-create` — `terminalCreate` answers `200` with the requested terminal id.
- `terminal-subscribe` — the subscribe handshake resolves (structured-clone safe, no unsubscribe function leaking over IPC) and replays prior output.
- `terminal-echo` — a written `echo <marker>` comes back in the pushed output frames.
- `terminal-kill` — `terminalKill` answers `200`.

## How to get to it (user POV)

- Open a terminal tab for the current workspace and type into it; output appears as in any terminal.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **PTY round trip.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs terminal`. The driver creates terminal `verify-terminal-1` in an isolated workspace, subscribes, writes `echo verify-<ts>`, waits for the marker in the output frames, kills the terminal, and prints `[ok] PTY round trip`, then `PASS`.
- **Proof.** Evidence holds `terminal-transcript.txt` (the raw collected output frames, marker included), `terminal.png`, and `facts.json`.

## Gotchas

- Everything happens inside one `page.evaluate` — the subscription callback lives in the page context; you cannot observe frames from outside.
- A `clone-leak` stage failure means an unsubscribe function crossed IPC again (the regression this journey guards); that is a real bug, not a harness flake.
- The PTY inherits the workspace dir the driver created; it never touches your real shell history.
