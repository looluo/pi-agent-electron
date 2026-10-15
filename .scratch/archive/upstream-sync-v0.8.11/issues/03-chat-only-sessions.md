# 03 — Port persisted chat-only sessions from pi-web

Status: resolved
Type: task
Upstream: `a5738cf` (feat: add persisted chat-only sessions; ADR upstream 0002-chat-only-tool-selection)

## What upstream built

Chat-only sessions persisted with their tool selection: `lib/chat-only.ts`, ChatInput mode entry,
`agent/[id]` + `sessions/[id]` route changes, i18n.

## Why deferred

- Touches `startRpcSession` construction paths shared with the subagents cluster.
- The upstream ADR ties it to subagent profiles ("explicit tool selection"), so it ports cleanly
  only after issue 01.

## Port plan sketch

1. Port `lib/chat-only.ts` + tests verbatim.
2. Adapt `agent` service new/existing-session construction to accept the chat-only flag.
3. Port ChatInput + useAgentSession + i18n hunks (transport already IPC-native here).

## Answer

Done on branch `sync/pi-web-v0.8.11` (after issues 05 + 01 + 02). The lib layer had already landed
with issue 01; this closes the UI + dispatch wiring:

- **ChatInput**: `chat-only` replaces `off` in the preset list (maps to toolPreset `none`), labeled
  via `t("chat.chatOnly")` in the button title and dropdown description (upstream a5738cf hunks).
- **agent service**: `agentCommand` intercepts `set_tools` before the live fast path and routes it
  through `setRpcSessionTools` — crossing the chat-only boundary shuts down and recreates the
  session (persisted selection survives reloads; subagent sessions are rejected).
- **sessionsGet fix**: `toolNames` moved to the top level of the response (`SessionData.toolNames`),
  where useAgentSession reads it. Issue 01 had parked it inside `info`, which typechecked but made
  the renderer silently fall back to `default` — a real drift the ledger exists to catch.
- **i18n**: `chat.noTools` renamed `chat.chatOnly` in all three locales ("仅聊天"/"僅聊天").
- **Tests**: upstream's "renders the empty tool preset as Chat only" added to ChatInput.test.

Verification: typecheck clean; `npm test` 745 (743 pass, 1 skip, 1 pre-existing Windows PATH
failure); `npm run test:e2e` 7/7.
