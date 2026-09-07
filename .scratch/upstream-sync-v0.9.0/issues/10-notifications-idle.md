# Issue 10: notifications-idle

Type: task
Status: resolved
Blocked by: 01

edf574a+bf4713c renotify repeated completion notifications (map to our desktop notification service); e9f954a idle timeout configurable — rpc-manager env PI_WEB_IDLE_TIMEOUT_MS → our agent service equivalent env/setting.

## Answer

Resolved in 002ffcf. renotify: true ported one-line (Electron renderer rides
Chromium Notification semantics; sw.js half n/a). Idle timeout env resolves
in the main process via process.env — no further adaptation needed.
Gate: typecheck clean, suites 23/23 + 7/7.
