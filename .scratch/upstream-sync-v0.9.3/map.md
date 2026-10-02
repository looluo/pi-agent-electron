# Upstream sync — pi-web v0.9.3 (040fadd..5d4c0b5)

## Notes

Selective port of `agegr/pi-web` v0.9.3 (100 non-merge commits after our
v0.9.2 sync point 040fadd) per ADR-0004. Ledger: `docs/upstream-sync.md`.
Local version will bump 0.9.2 → 0.9.3 to match the upstream release.

Scale: renderer 251 files +49,223 lines; app/api 31 files +3,734 (4 new MCP
route groups). Dominant theme: the MCP wave (ADR 0006) riding an SDK jump
0.87.0 → 0.99.1 (12 minors).

Execution order (risk first):

- 01 sdk-upgrade — pi 0.87.0 → 0.99.1, fix import/runtime fallout (—) — **resolved**
- 02 security-paths — `b3c7255` system-message/tool-result path
  authorization block; `687af27` symlinked folders (#1018); worktree
  real-path `82d1f54` (—) — **resolved**
- 03 chat-fixes — renderer fixes incl. reconciliation points:
  `d0bf6be` streaming reasoning-level change (#851, supersedes the
  disabled-control behavior we ported in 3f07a5), `0bae9b6` collapse
  once answered (#1011, coexists with local 26be91e), fork-while-running
  (#1023), history-edit drafts (#1009/#94c1f5c), extension dialog queue
  (#70470ca), composer text fixes (—) — **resolved**
- 04 settings-ux — shared blocks + i18n (197a3e5), enable/disable-all
  (#1020), heading switches (#1021), send key (#1001), group switches
  (#4de9f77) (—) — **resolved**
- 05 sessions-agent — SSE backlog bound (#997), shutdown races
  (aed0f3c/34c8fdf), system prompt first (#974), compaction reporting
  (#1008), truncation→compact (#968), history anchor paging (#941) (—) — **resolved**
- 06 models-fixes — discovery from provider catalog (#1006), typed
  provider save (#969), no global persistence of new-session picks
  (#871) (—) — **resolved**
- 07 subagents-fixes — ext: selector resolution (#946), resumed-run
  report (#991), orphan→interrupted (#990), result keying (#987/#989),
  model-only control tools (62542da) (—) — **resolved**
- 08 tools-codemode — Code mode via tools settings (1c387b4/ba044f9),
  CodemodeToolView (—)
- 09 mcp-wave — ADR 0006 P1/P2: per-session MCP host, Settings › MCP
  (list/add/parse/remove/test/OAuth), trust integration, security
  hardening; new `pi:mcp:*` IPC surface + OAuth push channel (01, 02, 08)

n/a (no ticket): demo Pages site (96966e5 etc.), Safari 16.2 (f52fd84),
PI_WEB_PASSWORD/Basic Auth (6ad18cd/beb32a9/3e1f436), Next/semver/undici
bumps (79c2a44), PWA, `e17d2cc` (SSE stream-down — IPC push already
survives renderer reconnects; verify opportunistically).

## Status

In progress.
