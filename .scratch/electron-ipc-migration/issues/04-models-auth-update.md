# 04: slice 3: models / models-config / auth / app-update

Status: open

Blocked by: 02

- Port models + models-config (CRUD/test/discover/catalog) handlers
- Port auth routes: login SSE -> auth:login push channel, manual-code POST -> invoke; keep token registry semantics
- app-update: main-process handler querying GitHub Releases (looluo/pi-agent2), reuse lib/app-update.ts comparison + ChatWindow notice, shell.openExternal for download page
- Live-test every provider auth flow in the packaged app
Gate: provider login/logout works for at least one OAuth and one API-key provider; model switch works

## Comments
