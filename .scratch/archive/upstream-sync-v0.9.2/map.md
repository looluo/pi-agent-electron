# Upstream sync — pi-web post-v0.9.1 (8366762..3f07a5f)

## Notes

Selective port of `agegr/pi-web` post-v0.9.1 `main` (13 non-merge commits, no
new release tag) into the Electron fork per ADR-0004, on `main`. Ledger:
`docs/upstream-sync.md`. Local version stays 0.9.2 (upstream has not tagged).

Order lesson: `b42d3f4` (issue 07) must land before `e70c367` (issue 04) —
e70c367's MessageView hunks carry b42d3f4's `tool-call-expansion` import in
context, and porting in log order (e70c367 first) conflicts on it.

Second lesson (recurring): several `3f07a5f` ChatInput hunks were silently
dropped by `git apply --3way` where our fork's context had drifted (indentation
artifacts from earlier syncs). Clean "OK" output is not proof — the new
`ChatInput.streaming-thinking.test.mjs` source-assertion suite is what caught
the four missed hunks (control slot, resolvedThinkingLevel, isActive/onClick,
prop wiring). Always port a feature's own tests in the same batch and run them.

Issue map (blocked-by in parens):

- 01 renderer-small-fixes — `ed0eea9` scroller edge, `fcd94bf` dialog title
  newlines, `860698a` widget font-size offset (—)
- 02 unc-file-paths — `c04bab7`, encoder fold + decoder tests (—); relevant to
  our Windows build (UNC cwd round-trips over pifile://)
- 03 worktree-fetch — `744ee93`, raised git timeouts + remote-tip start (—)
- 04 apply-patch-diffs — `e70c367`, split-diff preview + failure erroring (07)
- 05 composer-image-preview — `d2056b6`, ImagePreview lightbox on attachment
  thumbnails (—)
- 06 reasoning-level-display — `3f07a5f`, live level while streaming +
  auto-as-uncommitted-default; `app/api/models` `defaultThinkingLevel` re-homed
  onto the `pi:models` IPC response (—)
- 07 tool-expansion-persistence — `b42d3f4`, user-opened tool blocks stay
  expanded across streaming updates (—); coexists with our local
  default-collapse work (26be91e) — different state (per-toolCallId vs
  per-group anchors)

n/a commits (recorded in ledger, no ticket): `20ad98b` + `c1e544b` (web
password auth — HTTP form factor), `e5a2434` (Next.js 16.3.5 — we are Vite),
`135517b` (new-session branding via `next/image` + upstream logo — our branding
diverged at fork; layout alignment not portable without the asset).

New IPC surface: none. `pi:models` response body gained `defaultThinkingLevel`.
