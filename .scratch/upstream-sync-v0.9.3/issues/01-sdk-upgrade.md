# Issue 01: sdk-upgrade

Type: task
Status: resolved
Blocked by: —

pi SDK 0.87.0 → 0.99.1 (upstream 2bb48f5; 12 minors). The fork's surface
adaptations, mirroring upstream's own:

## Answer

Resolved. Changes:

- package.json: all four `@earendil-works/pi-*` pinned to 0.99.1.
- `lib/pi-types.ts`: taken from upstream verbatim — AgentSessionLike now
  matches the SDK shapes: `prompt()` options carry the disposition-style
  `preflightResult?: (disposition: "handled"|"queued"|"started") => void`;
  `steer`/`followUp` return `Promise<"handled"|"queued">`; ToolDefinition
  gains `exposure` (pi ≥ 0.99, needed by the MCP/codemode wave);
  AgentSession gains the pre-first-run readable `systemPrompt`.
- `lib/rpc-manager.ts`: preflight callback → `() => acceptPreflight()`
  (every disposition is an acceptance; rejection only rejects the promise —
  upstream 6ac87ec semantics).
- Tests: rpc-manager-shutdown preflight mocks call `preflightResult("started")`
  / plain rejection; rpc-manager clone test expects the source file (pi 0.99
  creates it on first user message) and rm-recursive cleanup; model-catalog
  integration stub matches the catalog URL by origin+pathname (SDK appends
  `?types=`).

Gate: typecheck clean; npm test 1179/1181 (2 win32 skips); test:e2e 12/12.
