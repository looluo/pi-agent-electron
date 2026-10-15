# Issue 05: plugins-top-level

Type: task
Status: resolved
Blocked by: —

Port ef51ffd: top-level origin extensions surfaced in the plugins response
(standaloneExtensions + scope/enabled + totals), PluginsConfig renders them, api-types
extended. Route hunk re-homed into electron/main/services/plugins.ts readPlugins.

## Answer

Resolved. collectResources gains standaloneExtensions; PluginStandaloneExtensionInfo
imported from api-types. Gate: PluginsConfig suite green, typecheck.
