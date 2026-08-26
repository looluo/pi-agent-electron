# Upstream sync — pi-web v0.8.9 → v0.8.11

## Notes

Selective port of `agegr/pi-web` `2a6e537..28bab3c` into the Electron fork per ADR-0004.
Ledger with per-commit status: `docs/upstream-sync.md`.

Done in the sync commit on branch `sync/pi-web-v0.8.11`:
- 27 upstream commits ported (renderer fixes/features, main-process libs, 3 IPC/pifile adaptations)
- 5 deferred clusters ticketed as issues 01–05 below
- verification: typecheck clean, unit 643/645 (1 known Windows PATH baseline failure), E2E 7/7

## Decisions so far

- Tool-result images: new `pifile://session/<id>/entries/<entryId>/tool-result-image` host on the
  existing custom protocol instead of an HTTP route — keeps "no HTTP port" (ADR-0003) and reuses
  the registered protocol privileges.
- rpc-manager tracks upstream at `d728526` with the `web-push.ts` coupling stripped (feature n/a);
  the optional completion-callback constructor stays for API compatibility.
- zh-TW completed beyond upstream (tools-panel keys) because our registry test enforces key parity;
  upstream's own zh-TW is currently incomplete there.

## Fog

- Subagents cluster ordering vs SDK 0.84.3 (issue 01 blocked by 05).
- Settings cluster (02) interleaves with AgentsConfig from 01 — sequence 05 → 01 → 02 → 03.
