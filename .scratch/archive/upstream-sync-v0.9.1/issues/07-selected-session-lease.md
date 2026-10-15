# Issue 07: selected-session-lease

Type: task
Status: resolved
Blocked by: 03

Port 0ff1138: selected sessions stay warm while idle — session-liveness leases (TTL 90s)
acquired per event stream, agent-event-stream holds/releases on stream lifecycle,
useAgentSession maintains the connection for the selected session and renews the lease
every 30s + on visibilitychange, reconnecting when renewed===0. HTTP lease route
re-homed as `pi:agent:lease` IPC (agentLease service → renewSessionLivenessLeases).
sessionRunning prop deleted end-to-end (AppShell→ChatWindow→hook).

## Answer

Resolved. Lease fetch adapted to window.pi.agentLease; test assertions rewritten for the
IPC form (+ doesNotMatch for the removed sessionRunning plumbing). New IPC surface:
pi:agent:lease. Gate: useAgentSession + session-liveness + agent-event-stream suites green.
