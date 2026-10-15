# Issue 03: session-model-forks

Type: task
Status: resolved
Blocked by: —

Port ed840ed (session models restored/displayed accurately), 585d56c (first-message
session forks), def1478 (shell output preserved across reconnects; rpc-manager
activeToolEvents replay). Transport stays window.pi (agentState instead of fetch);
rpc-manager-shutdown tests that arrived with these hunks imported wholesale (our fork
had the implementation but never the tests).

## Answer

Resolved. useAgentSession conflicts resolved per form factor; maybeAutoNameSession
(PR #45) kept in deps. Gate: rpc-manager + useAgentSession suites green.
