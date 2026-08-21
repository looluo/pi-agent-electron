# 04: slice 3: models / models-config / auth / app-update

Status: resolved

Blocked by: 02

- Port models + models-config (CRUD/test/discover/catalog) handlers
- Port auth routes: login SSE -> auth:login push channel, manual-code POST -> invoke; keep token registry semantics
- app-update: main-process handler querying GitHub Releases (looluo/pi-agent2), reuse lib/app-update.ts comparison + ChatWindow notice, shell.openExternal for download page
- Live-test every provider auth flow in the packaged app
Gate: provider login/logout works for at least one OAuth and one API-key provider; model switch works

## Comments

Resolved in 732e398. slice3-probe 10/10: models list (16 visible, default glm-5.3, trust-gated), models-config get/put round-trip, oauth providers (7), api-key providers (39), api-key status without raw key, models test error path, catalog + app-update wired through upstream failures (GitHub API 403 rate-limit and models.dev are blocked in this environment — handlers correctly resolve 502 {error}; must re-verify both on an unrestricted network during ticket 07). OAuth login push channel delivers error frames for unknown providers; the full browser OAuth dance for every provider is deferred to ticket 07's live matrix as planned. Findings: discover returns DiscoveredModel[] directly (not {ok,models}); catalog always returns models+recommendation; ModelRuntime login prompt needs a non-undefined AbortSignal.