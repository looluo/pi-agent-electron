# Bash full output

When an agent bash run's output is truncated in the chat, a "view full output" button loads the complete log over IPC and shows it inside the tool-call block.

## Sub-features

- `bash-render` — a saved `bashExecution` renders as a collapsible tool-call block.
- `bash-view-full` — the "view full output" button (zh-CN `查看完整输出`) loads the full log over IPC (`pi:agent:bash-output`).
- `bash-no-dead-fetch` — no "Failed to fetch" appears (the renderer is file://-origin; HTTP calls are dead here).

## How to get to it (user POV)

- Open a session containing a bash tool call with truncated output; expand the bash block; choose "view full output" to load the complete log into the card.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **Load the full log.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs bash-full-output`. The driver seeds a session with a truncated `bashExecution` pointing at a log file containing `VERIFY-BASH-FULL-OUTPUT-MARKER-77ce`, opens the session, clicks the row, expands the bash block (`bash echo fixture-long-output`), then clicks the view-full button, and prints `[ok] expanded the bash block`, `[ok] clicked view full output`, `[ok] full log loaded over IPC`, then `PASS`.
- **Proof.** Evidence holds `bash-full-output-loaded.png` (marker text visible inside the expanded block) and `facts.json`.

## Gotchas

- **Expand before the button:** upstream's footer redesign draws the view-full button inside the bash card, under the result, so the button is not in the DOM while the card is collapsed (tool cards default to collapsed on a fresh app). Waiting for the button before expanding times out — the e2e spec encodes the expand-first order.
- The IPC handler only serves files directly inside `os.tmpdir()` named `pi-bash-*.log` and referenced verbatim by the session's bash entry — the driver stages exactly that; don't relocate the log.
- This journey is the template for other deferred-content paths (thinking blocks, markdown images) — see `tests/e2e/thinking.spec.ts` and `tests/e2e/markdown-image.spec.ts`.
