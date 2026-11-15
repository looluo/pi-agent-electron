# Bash full output

When an agent bash run's output is truncated in the chat, a "view full output" button loads the complete log over IPC and shows it inside the tool-call block.

## Sub-features

- `bash-render` — a saved `bashExecution` renders as a collapsible tool-call block.
- `bash-view-full` — the "view full output" button (zh-CN `查看完整输出`) loads the full log over IPC (`pi:agent:bash-output`).
- `bash-no-dead-fetch` — no "Failed to fetch" appears (the renderer is file://-origin; HTTP calls are dead here).

## How to get to it (user POV)

- Open a session containing a bash tool call with truncated output; choose "view full output"; expand the bash block to read the complete log.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **Load the full log.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs bash-full-output`. The driver seeds a session with a truncated `bashExecution` pointing at a log file containing `VERIFY-BASH-FULL-OUTPUT-MARKER-77ce`, opens the session, clicks the row, clicks the view-full button, expands the bash block, and prints `[ok] view-full-output button`, `[ok] expanded the bash block`, `[ok] full log loaded over IPC`, then `PASS`.
- **Proof.** Evidence holds `bash-full-output-loaded.png` (marker text visible inside the expanded block) and `facts.json`.

## Gotchas

- The IPC handler only serves files directly inside `os.tmpdir()` named `pi-bash-*.log` and referenced verbatim by the session's bash entry — the driver stages exactly that; don't relocate the log.
- The full log lands inside the collapsed tool-call pane: expand the bash block (`bash echo fixture-long-output`) or you will screenshot the preview, not the proof.
- This journey is the template for other deferred-content paths (thinking blocks, markdown images) — see `tests/e2e/thinking.spec.ts` and `tests/e2e/markdown-image.spec.ts`.
