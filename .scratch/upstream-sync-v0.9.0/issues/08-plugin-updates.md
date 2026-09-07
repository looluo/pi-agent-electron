# Issue 08: plugin-updates

Type: task
Status: resolved
Blocked by: 01

Port 50b7f79 (#611): plugin update check + bulk update. lib/plugin-updates.ts + PluginsConfig renderer mostly portable; app/api/plugins/check → main-process service + pi:plugins:check IPC.

## Answer

Resolved in a031cd4. lib + renderer ported directly; app/api/plugins/check
became the pi:plugins:check IPC channel (preload + PiBridge typed);
bulk-update fetch rewritten onto the existing pi:plugins:action. Main
pluginsList now computes canCheckForUpdates; bulk update gained the
untrusted-project guard. semver 7.8.0 added.
Gate: typecheck clean, plugin-updates 5/5.
