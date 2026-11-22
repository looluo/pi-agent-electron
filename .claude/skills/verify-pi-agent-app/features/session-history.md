# Session history

The sidebar lists saved sessions, titled by a stored name when one exists and otherwise by the first user message; opening one loads the newest slice of the context (default: the last 50 entries) into the chat pane from the session `.jsonl` on disk, with earlier turns paging in on demand.

## Sub-features

- `history-list` — the sidebar shows the fixture session (unnamed, so titled by its first user message).
- `history-open` — clicking the row renders the saved assistant reply in the chat pane.
- `history-facade` — `window.pi.sessionsList()` reports the session.

## How to get to it (user POV)

- Look at the session sidebar after launch; saved sessions appear as rows.
- Click a row to open that session and read its history.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes.

- **Open the fixture session.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs session-history`. The driver seeds an isolated agent home with one session (first message `history fixture e2e`, assistant reply containing `HISTORY-PROOF-REPLY-5b1d`), launches, clicks the row, and prints `[ok] session row in sidebar`, `[ok] opened session from sidebar`, `[ok] history context rendered`, `[ok] facade confirms the session`, then `PASS`.
- **Proof.** Evidence holds `sidebar-lists-session.png` (action: row visible before click), `session-context-loaded.png` (result: assistant reply rendered), and `facts.json`.

## Gotchas

- Session rows are clickable divs; a persisted session's title is a real anchor inside that div (plain click opens, middle/Cmd-click deep-links). Match the row by its first-message text, not a role.
- A named session (renamed or auto-named) shows the stored name, not the first message; the first paint can also show a brief "…" pending row while summary details hydrate.
- The first paint can take up to ~20 s on a cold start; the driver waits, don't race it.
- Deferred content inside history (thinking blocks) loads only on expand — see the [thinking spec](../../../../tests/e2e/thinking.spec.ts) for that path.
