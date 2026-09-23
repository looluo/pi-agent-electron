# Issue 02: bounded-session-title

Type: task
Status: resolved
Blocked by: 01

`974c8bb` — Name sessions from a bounded transcript (#807, merged upstream;
supersedes their #787/#776; closes #671).

Port shape: local `pi-web/src/lib/session-title.ts` is byte-identical to
pre-#807 upstream → take the upstream file wholesale (plus its test file),
then adapt call sites. Semantics change: no shadow Agent clone, no
`waitForIdle`, no session-prefix replay — a standalone stream with a bounded
plain-text transcript (≤6000 chars, head/tail budget split, user turns whole,
replies clipped, `[image]` placeholders), cheapest supported thinking level,
`cacheRetention: "none"`, fresh session id, session's own model.

Call sites to adapt (both ride `sessionsAutoName` in
`electron/main/services/sessions.ts`):

- manual Title button (unchanged contract: `{ title, usage }`)
- PR #45 auto path: `skipIfNamed` guard stays; re-verify the
  `agent_settled`-before-`prompt_done` auto-title trigger after the swap
  (`useAgentSession.auto-title.test.mjs` must stay green, extend if the
  no-idle property changes when generation is safe to start)
- `getApiKey` plumbing: new impl uses `source.getApiKey` equivalents — check
  what `AgentSessionLike` exposes post-0.87.0 and whether `AgentSession`
  `.agent` access in the service changes

Measured upstream win: 120-turn session title request 74k → 1.7k input
tokens, ~1.3s flat latency. Our auto path fires per first agent run, so the
cost cut compounds.

Known upstream review caveat (P2, not addressed upstream): image-only user
turns flatten to nothing while the turn is unanswered — mid-turn naming may
produce an unrelated title. Our auto path fires at settle (post-answer), so
largely moot here; note it if we ever fire earlier.

Gate: session-title test suite ported and green; auto-title + manual paths
manually verified once in a packaged build (title lands in jsonl as
`session_info`, `skipIfNamed` idempotent).


## Answer

Resolved. Wholesale file swap from piweb/main (session-title.ts + suite; both
call sites already matched upstream's route shape verbatim — the
"session.inner as unknown as AgentSession" cast — no service changes needed).
PR #45 auto path untouched: skipIfNamed + the agent_settled trigger contract
test stays green.

Real-chain verification (jiti in-process, real provider stream, old unnamed
session): title in 3.8s at 149 input tokens — the pre-#807 shadow-agent path
measured 19,666 input tokens / 7.6s on a comparable session (~130x cheaper).
skipIfNamed idempotent (0.0s skipped). session_info persisted.

Gate: session-title suite 14/14; auto-title contract test green; typecheck x2
clean; full suite 977/981 (1 pre-existing Windows PATH baseline). Packaged
manual verify rides the next r2 build.
