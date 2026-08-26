# Upstream sync — pi-web v0.8.9 → v0.8.11

## Notes

Selective port of `agegr/pi-web` `2a6e537..28bab3c` into the Electron fork per ADR-0004.
Ledger with per-commit status: `docs/upstream-sync.md`.

Done in the sync commit on branch `sync/pi-web-v0.8.11`:
- 27 upstream commits ported (renderer fixes/features, main-process libs, 3 IPC/pifile adaptations)
- 5 deferred clusters ticketed as issues 01–05 below
- verification: typecheck clean, unit 643/645 (1 known Windows PATH baseline failure), E2E 7/7

## Decisions so far

- 2026-08: pi SDK upgraded 0.84.2 → 0.84.3 (issue 05 resolved). Only breaking change in 0.84.3
  (`GoogleThinkingLevel` rename) is unreferenced here; full gate green. New SDK surfaces to
  exploit later: `powershell` tool (issue 02), `session_compact_failed` events (subagent runtime).
  Frontier is now issue 01 (subagents), no remaining blockers.

- Tool-result images: new `pifile://session/<id>/entries/<entryId>/tool-result-image` host on the
  existing custom protocol instead of an HTTP route — keeps "no HTTP port" (ADR-0003) and reuses
  the registered protocol privileges.
- rpc-manager tracks upstream at `d728526` with the `web-push.ts` coupling stripped (feature n/a);
  the optional completion-callback constructor stays for API compatibility.
- zh-TW completed beyond upstream (tools-panel keys) because our registry test enforces key parity;
  upstream's own zh-TW is currently incomplete there.

## Decisions additions

- 2026-08 (2): issue 01 (subagents cluster) resolved. Ships dark (subagent-settings default off,
  matching upstream 96c643a). rpc-manager tracks upstream ec98e1c (web-push stripped). Pulled from
  02/03 as compile deps: SettingsUi/ModelSelector/settings.css/settings-navigation (4903dcb ChatInput
  hunk too), chat-only + session-tool-selection + powershell-settings libs. Frontier is now issue 02
  (SettingsPanel rollout + powershell IPC), then 03's remaining UI, then 04.


- 2026-08 (3): issue 02 (settings unification) resolved. SettingsPanel is the single config surface;
  Models/Skills/Plugins at upstream 28bab3c on typed IPC; auth providers merged (602b1b6); tools-settings
  IPC added. AgentsConfig unmounted + subagent gate hard-false (upstream 96c643a release parity).
  Frontier: issue 03 (chat-only UI wiring — lib layer already in), then 04 (residual trim audit).


- 2026-08 (4): issue 03 (chat-only UI) resolved. Includes a real drift fix from the issue-01 port:
  sessionsGet toolNames belonged at the response top level (SessionData.toolNames), not inside info.
  Frontier: issue 04 only (audit-shaped).

## Fog

- Subagents cluster ordering vs SDK 0.84.3 (issue 01 blocked by 05).
- Settings cluster (02) interleaves with AgentsConfig from 01 — sequence 05 → 01 → 02 → 03.
