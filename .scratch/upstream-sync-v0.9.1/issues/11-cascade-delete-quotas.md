# Issue 11: cascade-delete-quotas

Type: task
Status: resolved
Blocked by: 08

Port e83f4b5: deleting a session cascades to every persisted or live subagent
descendant (rpc-manager getRpcSessionInfos gains includeTransient); mirrored into
electron sessionsDelete. Port 6d53fd5: provider usage quotas (lib 372 lines,
ProviderUsageSummary, ModelsConfig sections); HTTP query route re-homed as
`pi:provider-usage:query` IPC.

## Answer

Resolved. Cascade re-parent loop skips deleted paths; abort+shutdown descendants
before unlinking all. ProviderUsageSummary fetch adapted to
window.pi.providerUsageQuery. Gate: provider-usage suite green, typecheck.
