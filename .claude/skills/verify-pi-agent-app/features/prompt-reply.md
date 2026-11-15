# Prompt → reply

A user types a message in the chat box and the agent (real LLM) replies in the conversation; the exchange is persisted as a session file. This is the app's core loop.

## Sub-features

- `prompt-new-session` — sending the first prompt creates a session for the workspace.
- `prompt-reply-marker` — the model's reply arrives and contains the requested marker text.
- `prompt-persist` — the session `.jsonl` is written under the isolated agent home.

## How to get to it (user POV)

- Type a message into the chat input and send it; the reply streams into the conversation.

## Driving it with drive.mjs

Preconditions:

- `npm run build` ran; `drive.mjs doctor` passes **including** `auth.json + models.json present` — this journey hits the real LLM with your real credentials (copied into the isolated agent home, so nothing is written to your real sessions).

- **Round trip.** Run `node .claude/skills/verify-pi-agent-app/scripts/drive.mjs prompt-reply`. The driver creates a session via `window.pi.agentNew`, prompts `Reply with exactly: VERIFY_OK_5b1d`, polls until the run settles, and prints `[ok] session created`, `[ok] prompt sent`, `[ok] run settled`, `[ok] reply contains marker`, `[ok] session persisted`, then `PASS`.
- **Proof.** Evidence holds `prompt-reply.png` and `facts.json` quoting the assistant reply. Exit `3` means SKIP (credentials missing) — a skip, not a pass.

## Gotchas

- Costs real tokens; use it when a change touches the prompt loop, session persistence, or model plumbing.
- "Settled" means `get_state` reports `isStreaming` and `isPromptRunning` both false — wait for it, don't read the reply early.
- If auth exists but the reply never settles, check `doctor` and the staged `models.json` before blaming the app.
