# 01 — Port the built-in subagents cluster from pi-web

Status: open
Type: task
Upstream: `baa600b`…`96c643a` (~25 commits between v0.8.10 and v0.8.11)

## What upstream built

Built-in, inspectable subagents: `lib/subagents.ts`, `lib/subagent-extension.ts`,
`lib/subagent-runtime.ts`, `lib/subagent-settings.ts`, `lib/session-family.ts`,
`app/api/subagents/**` routes, `components/AgentsConfig.tsx`, `AgentSessionPanel` (subagent session
switcher in sidebar), subagent relation metadata on sessions (session-reader), background subagent
completion delivery, chat-input integration (pass text files / profiles to subagents).

Upstream shipped v0.8.11 with the feature **disabled for release** (`96c643a`), so there is no
user-visible pressure yet.

## Why deferred

- Largest cluster in the range; touches rpc-manager, session-reader, sidebar, ChatInput, settings.
- Requires pi SDK ≥ 0.84.3 (see issue 05) — several fixes (`60b7413`, `99fc442`, `39e50e0`) chase
  SDK behavior we have not upgraded to.
- Needs new IPC surfaces (subagent profiles CRUD, subagent session detail, relation reads) — design
  the facade before porting, per ADR-0004.

## Port plan sketch

1. Upgrade pi deps to 0.84.3 (issue 05) first.
2. Port `lib/subagents*.ts` + `lib/session-family.ts` and their tests verbatim (pure Node libs).
3. Re-home `app/api/subagents/**` as typed IPC facades (`window.pi.subagents*`).
4. Port renderer: AgentsConfig, AgentSessionPanel, sidebar relation display, ChatInput wiring.
5. Re-apply the release-disable gate (`96c643a`) so it ships dark, matching upstream.
