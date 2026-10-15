# Upstream sync — pi-web v0.9.2 wave (3f07a5f..040fadd)

## Notes

Selective port of `agegr/pi-web` `3f07a5f..040fadd` (47 non-merge commits,
upstream tag v0.9.2) into the Electron fork per ADR-0004, on `main`. Ledger
inventory with per-commit classification: `docs/upstream-sync.md` (section
"drift inventory: 3f07a5f..040fadd"). Local version stays 0.9.2.

Ticket order = suggested execution order. Batching follows upstream file
coupling, not subject grouping: `da1b28b` (SDK 0.87.0) re-types twelve files
the other commits build on, so issue 01 gates everything; issues 05 and 06
both reshape `hooks/useAgentSession.ts` and `lib/session-reader.ts` and are
therefore serialized (05 first — smaller hunks, lower risk).

Recurring lessons that apply to this wave (from v0.9.2 issues 01–07):

- `git apply --3way` silently drops hunks where our context drifted
  (ChatInput especially). Port each feature's own source-assertion tests in
  the same batch; a clean apply is not proof.
- Port in dependency order, not log order, when hunks carry neighbors'
  imports in context.
- `app/**` routes re-home onto typed IPC; every `fetch('/api/…')` assumption
  rewrites to `window.pi.*`.

PR #45 interaction (local-only auto session titles): issue 02 replaces
`lib/session-title.ts` wholesale (local copy is byte-identical to pre-#807
upstream). The new `generateSessionTitle` no longer clones a shadow Agent nor
waits for idle — `services/sessions.ts` call sites (manual button + auto path,
both sharing `sessionsAutoName`) keep working, but re-verify the
`agent_settled`-before-`prompt_done` trigger still fires after the swap, and
note the no-idle property now allows firing auto-name earlier than settle if
we ever want to.

## Issue map (blocked-by in parens)

- 01 sdk-0870-base — `da1b28b`, pi SDK 0.85.1→0.87.0, 12-file adapter sweep (—)
- 02 bounded-session-title — `974c8bb` #807, standalone bounded-transcript
  title request; file swap + call-site adaptation (01)
- 03 models-panel-batch — `50f6cce` enabledModels switches, `058341d` manual
  catalog refresh, `8b084d3` stale-quota relative time, `6e95fba` OpenCode Go
  quota, `79894b9` extension-registered providers (01)
- 04 subagents-batch — `f07d4a2` per-built-in off switch, `54aa49c` background
  results as non-user, `12d3599` collected-result notification drop,
  `20a2579` session ID in completion text, `9d282da` provider stream errors
  as failed runs (01)
- 05 chat-ui-batch — 15 commits: scroll-to-latest, grabbable scrollbars,
  resizable sidebar panes, minimap hover counts, truncation surface, first-
  chunk dedup, subagent-notification reply visibility, selection-toolbar
  z-index, StrictMode stream reopen, widget order, changed-file mention rows,
  PDF #page=, collapsed-card tool images, /auto-compact, defaultTools
  override fix (01)
- 06 session-perf-batch — `234e19e` session view cache + revisions (#940),
  `50a2fd4` visible-message tail budget (#810), `b44017a` external pi-process
  writes (#796) (01, 05)
- 07 plugins-batch — `38cba2b` package description, `fce666a` Windows
  relativePath separators, `afd2575` npm checks without npm.cmd shim (—)

n/a commits (recorded in ledger, no ticket): `ffb2daf` (#790 full-width
toggle — local PR #548 maximized panel is a superset; maximized-close fixed
in d8e3b85), `ef1de89` (#887 per-tab session memory — local workspace-memory
already restores per project), `31f0505` (Next proxy buffer), `1f79174`
(SSE shutdown drain — no Next; opportunistically verify IPC push teardown on
window-close), `b4a4539` (PWA), `404923e` (CLI RISC-V), `a84093e` (Edge
instrumentation), `47a0bb2` (web auth tokens), `58c1a21` (.gitignore),
`040fadd` (release tag), `eac6f14`/`ed7a4d7`/`6edbecb`/`5b96a9d` (e2e/docs).

Expected new IPC surface: `pi:models` extensions (`enabledModels` mutation,
`refresh`), `pi:subagents:*` additions (per-profile disable), plugins route
shape change. Exact channels settled per-issue.
