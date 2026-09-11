# Issue 08: subagents-p0

Type: task
Status: resolved
Blocked by: —

Port the subagent P0 cluster: b77a25f (queue concurrent runs), a31d5c5 (resume
persisted sessions), bbe2f7d (tintinweb profiles), 2661247 (worktree isolation),
e3fbbf6 (extension tool selectors), b5b52f0 (compact settings UI, settings.css
remap), f106531 (merge), 553f2d7 (keep agent profile fields this app does not
own). Electron: settings IPC gains maxConcurrent, profile toggle carries
promptMode.

## Answer

Resolved. lib/subagents.ts + lib/subagent-settings.ts byte-identical to upstream
8366762. Conflicts: zh-TW i18n (ours-as-base + new agents.maxConcurrent keys),
types.ts duplicate SubagentSessionStatus dedup. Gate: subagents/runtime/queue/
AgentsConfig suites green, typecheck.
