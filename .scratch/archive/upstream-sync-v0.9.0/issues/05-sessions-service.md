# Issue 05: sessions-service

Type: task
Status: resolved
Blocked by: 01

Service-side sessions: 8cbafdd metadata cache across scans/restarts, 9cf8d4d delete sessions with missing parent file, f57b565 preserve sessions with extension-owned work, edf0deb delete unpersisted runtime sessions (#440), cd6032b session-reader compaction pagination fix. API routes → electron sessions service / typed IPC.

## Answer

Resolved in fb9d20f. All five commits ported: two lib-level (cd6032b,
8cbafdd scanner) apply directly; three service-level (9cf8d4d, edf0deb)
adapted into electron sessionsDelete as ENOENT guards; f57b565 liveness
registry ported with the web-push import stripped per ledger convention.
Shutdown-test helper needed the upstream sessionId field (idle matcher
reads wrapper.sessionId). Gate: typecheck clean, suites green.
