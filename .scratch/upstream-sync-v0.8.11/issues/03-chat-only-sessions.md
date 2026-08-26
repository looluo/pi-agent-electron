# 03 — Port persisted chat-only sessions from pi-web

Status: open
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
