# Terminal

The app hosts workspace terminals (xterm.js in the renderer, node-pty in the main process) over typed IPC: authorize the workspace folder, create a terminal, subscribe to its output stream, wait for the shell's prompt, write a command, read the echoed output.

## Sub-features

- `terminal-authorize` — a workspace folder becomes an allowed file root through the folder picker's `cwdValidate`; without it `terminalCreate` answers `403 Access denied` (the real UI never offers a terminal for an unauthorized folder).
- `terminal-create` — `terminalCreate` answers `200` with the requested terminal id for an authorized cwd; a deleted folder answers the typed `400` cwd-missing refusal (`reason: "cwd-missing"`); a non-directory answers `400`.
- `terminal-subscribe` — the subscribe handshake resolves (structured-clone safe, no unsubscribe function leaking over IPC) and replays prior output.
- `terminal-echo` — after the shell prints its first output (the prompt), a written `echo <marker>` comes back in the pushed output frames.
- `terminal-kill` — `terminalKill` resolves a plain `true` boolean (the channel carries no HTTP-shaped body).

## How to get to it (user POV)

- Open a terminal tab for the current workspace and type into it; output appears as in any terminal.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **PTY round trip.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs terminal`. The driver validates the workspace folder (the picker's authorization path), creates terminal `verify-terminal-1`, subscribes, waits for the shell's prompt, writes `echo verify-<ts>`, waits for the marker in the output frames, kills the terminal, and prints `[ok] PTY round trip`, then `PASS`.
- **Proof.** Evidence holds `terminal-transcript.txt` (the raw collected output frames, marker included), `terminal.png`, and `facts.json` (the step detail carries the replay byte count).

## Gotchas

- Everything happens inside one `page.evaluate` — the subscription callback lives in the page context; you cannot observe frames from outside.
- Type only after the shell's first output: a fresh shell's line editor (zsh's zle) flushes pending input when it starts, so a write that lands before the prompt is eaten and the command never runs. The journey waits for the prompt (replay or first live frame) first.
- A `clone-leak` stage failure means an unsubscribe function crossed IPC again (the regression this journey guards); that is a real bug, not a harness flake.
- A `create`-stage `403` with no prior `cwdValidate` is the authorization gate working, not a bug — authorize the folder first, as the UI does.
- The PTY inherits the workspace dir the driver created; it never touches your real shell history. The shell is the user's login shell (`$SHELL -l`).
