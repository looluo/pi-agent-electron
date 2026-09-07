# Issue 11: terminal-tabs

Type: task
Status: resolved
Blocked by: 01

Terminal integration (9290c27 + ce18006): DROP upstream HTTP/SSE routes; Electron main-process node-pty 1.2.0-beta.15 service + pi:terminal:* typed IPC streams; renderer xterm.js (TerminalPanel/TabBar/AppShell ported). N-API so no electron-rebuild expected; electron-builder must ship node-pty prebuilds (memory lesson from Tauri app). Do last.

## Answer

Resolved in 9eb1996. Manager ported verbatim into pi-web/src/lib (runs in
main like rpc-manager); HTTP/SSE replaced by pi:terminal:* channels with a
per-subscription push token (file-watch pattern). Client-generated ids ride
through create. node-pty 1.2.0-beta.15 N-API — no electron-rebuild; ships
prebuilds/win32-x64; asarUnpack added. E2E 7/7.
