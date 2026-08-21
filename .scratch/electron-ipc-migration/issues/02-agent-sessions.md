# 02: slice 1: agent + sessions over IPC

Status: open

Blocked by: 01

- Port rpc-manager.ts, session-reader.ts, pi-types into electron/main unchanged (in-process SDK)
- Typed facade for sessions routes; single agent:command dispatch channel mirroring rpc-manager send() switch
- Push channels agent:[id]:events + agent:running replacing the two SSE endpoints
- Rewrite lib/agent-client.ts + hooks/useAgentSession.ts transport (fetch/EventSource -> window.pi invoke/on)
- Delete SSE reconnect/polling-reconciliation logic that exists only for unreliable HTTP; keep refresh-on-mount full-state sync
Gate: prompt->reply round trip works in the window; fork works; session list + switching works

## Comments
