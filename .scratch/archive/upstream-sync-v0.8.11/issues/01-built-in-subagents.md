# 01 — Port the built-in subagents cluster from pi-web

Status: resolved
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

## Answer

Done on branch `sync/pi-web-v0.8.11` (follows the SDK 0.84.3 upgrade from issue 05).

**Lib layer** — taken verbatim at upstream final state (28bab3c): `subagents.ts`,
`subagent-extension.ts`, `subagent-runtime.ts`, `subagent-settings.ts` (default **off** — the
release-disable gate from `96c643a` is the default), `session-family.ts`, `session-tree.ts`,
`subagent-prompt.ts`, `subagent-input.ts`, `subagent-profile-precedence.ts`, plus
`powershell-settings.ts` (runtime dep) and `chat-only.ts` + `session-tool-selection.ts` (woven into
rpc-manager; issue 03's lib layer — its UI remains open).

**Shared files** — `rpc-manager.ts` taken at `ec98e1c` (last subagents-cluster touch) with the
web-push coupling re-stripped; `session-reader.ts` taken at `ec98e1c` + our two adaptations
re-applied (pifile:// image URLs, 353757b branch fields); `pi-types.ts` at `ec98e1c` (SDK 0.84.3
interface mirror); `types.ts`/`api-types.ts` additive.

**Electron re-homing** — `electron/main/services/subagents.ts` ports `/api/subagents/**` (run
inspect/steer/abort, profiles list/save/toggle/delete, settings get/put) behind 8 typed
`pi:subagents:*` channels (preload + `pi-ipc.ts` typed). `sessionsList` gains
`completionNotificationSuppressedSessionIds`; `sessionsGet` gains relation info + subagent-scoped
`toolNames`; `sessionsDelete` gains the 39e50e0 relation-reparent fix.

**Renderer** — AgentsConfig (at `a7f6ab5`, fetches → `window.pi`), AgentSessionPanel switcher
(AppShell top panel "agents"), SessionSidebar family collapse (inline tree +
SessionTreeItem removed; `listSessionFamilies`), MessageView subagent tool-result display (at
`a7f6ab5` + our sessionsThinking IPC), ChatWindow `onOpenSession` + silent subagent completion,
AppShell alert guards.

**Dependencies pulled from issue 02/03** (required for compilation): `SettingsUi.tsx`,
`settings-navigation.ts`, `ModelSelector.tsx`, `settings.css` (1151-line stylesheet, imported from
`main.tsx`), and `4903dcb`'s ChatInput ModelSelector refactor. The cross-component rollout of
SettingsUi onto Models/Skills/Plugins (10 tests) is skipped pending issue 02.

i18n: 66+ keys added to all three locales; zh-TW translated where upstream lacks them (registry
test enforces parity).

**Verification**: typecheck clean; `npm test` 744 tests — 732 pass, 11 skipped (10 = issue-02
rollout, 1 pre-existing), 1 fail (pre-existing Windows PATH baseline); `npm run test:e2e` 7/7.
