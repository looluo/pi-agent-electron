# Issue 04: subagents-batch

Type: task
Status: ready-for-agent
Blocked by: 01

Five subagent fixes/features. Local base: subagents ported through v0.9.1
(queue concurrency, resume, worktree isolation, profiles), release gate
**default off** — keep that.

- `f07d4a2` — switch individual built-in sub-agents off (#874).
  `lib/subagent-settings.ts` + `lib/subagents.ts` + AgentsConfig UI;
  `app/api/subagents/profiles` shape → extend `pi:subagents:*` IPC.
- `54aa49c` — mark background results as non-user messages (#875):
  `subagent-extension.ts` / `subagent-runtime.ts`.
- `12d3599` — drop the completion notification for an already collected
  result (#889): same pair.
- `20a2579` — include session ID in foreground completion text (#847):
  `subagent-extension.ts` i18n string.
- `9d282da` — report provider stream errors as failed runs (#886):
  `subagent-runtime.ts`.

Order: `9d282da` and `54aa49c`/`12d3599` all touch subagent-runtime — port in
upstream log order (oldest first: 9d282da → 20a2579 → 12d3599 → 54aa49c →
f07d4a2) to keep hunks applying.

Gate: typecheck ×2; subagent suites green; one manual run with the release
gate temporarily on (verify per-profile off switch + failure surfacing),
gate back off before commit.
