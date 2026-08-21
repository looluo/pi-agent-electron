# 02: slice 1: agent + sessions over IPC

Status: resolved

Blocked by: 01

- Port rpc-manager.ts, session-reader.ts, pi-types into electron/main unchanged (in-process SDK)
- Typed facade for sessions routes; single agent:command dispatch channel mirroring rpc-manager send() switch
- Push channels agent:[id]:events + agent:running replacing the two SSE endpoints
- Rewrite lib/agent-client.ts + hooks/useAgentSession.ts transport (fetch/EventSource -> window.pi invoke/on)
- Delete SSE reconnect/polling-reconciliation logic that exists only for unreliable HTTP; keep refresh-on-mount full-state sync
Gate: prompt->reply round trip works in the window; fork works; session list + switching works

## Comments

Resolved in 94898b0. Gate verified via CDP end-to-end probe against the real app: session list (45 sessions), new session, real LLM prompt→reply round trip (glm-5.3), get_state, rename, events push `connected` frame, fork with real entryId. 581/584 tests green (3 known baseline failures). Findings: pi SDK is ESM-only so main builds as ESM (.mjs); AgentEventConnection's EventSource abstraction let the event transport swap without touching handshake/reconnect logic; prompt preflight vs completion timing matters for tooling (wait for get_state settle); deleting a fork-before-first-message session ENOENTs — pre-existing upstream behavior, UI guards it via transient flag.