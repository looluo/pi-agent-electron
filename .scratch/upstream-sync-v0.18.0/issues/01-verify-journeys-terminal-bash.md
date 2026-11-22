# verify-pi-agent-app: terminal and bash-full-output journeys are red on a clean tree

Status: resolved (commit 433cf777 — the skill's driver now carries the proven fixes: cwdValidate authorization, prompt-before-write, kill boolean; expand-first ordering)
Found: 2026-11-22, during the v0.18.0 upstream sync's app-drive verification

## Problem

Both journeys fail identically on the pre-sync HEAD build (`c6d6cd0d`) and on
the synced tree, so they are journey defects, not sync regressions (proven by
running them against a HEAD worktree build):

- `terminal` fails at stage create with `403 Access denied`: the journey calls
  `window.pi.terminalCreate(<temp workspace>)` directly, but a fresh isolated
  agent home stages no sessions, so the workspace is never an allowed file
  root. The real user path opens a session (project) first — an `agentNew`
  call before `terminalCreate` unblocks it (scratch proof in
  `drive-terminal.mjs` next to this file). With that fix the journey then
  stalls at stage echo on BOTH builds: the PTY echoes the typed command but
  the shell's output never arrives inside the wait. The e2e spec suite's
  `terminal.spec.ts` (same bridge, repo cwd) passes 13/13 on both builds, so
  the stall is specific to the journey's bare temp workspace, likely
  shell-startup-related on this machine.
- `bash-full-output` times out waiting for the 查看完整输出 button on both
  builds; `bash-output.spec.ts` passes in the suite on both builds.

## What a fix needs

- `journeyTerminal`: create the session for the workspace first (agentNew
  `{cwd, type: "ensure_session", toolNames: []}`), then investigate the echo
  stall (shell choice / env in the staged PTY vs the spec's).
- `bash-full-output`: diff the journey's fixture seeding against
  `bash-output.spec.ts`'s (the spec sees the button; the journey does not).
- Do not weaken either journey to pass; both already have green spec-suite
  twins, so the journeys just need to reach parity with the specs' setup.

## Comments

2026-11-22: resolved by the verification-skill maintenance pass (433cf777).
Root causes: the terminal journey skipped the allowed-file-root authorization
(cwdValidate now gates it) and raced its write past the shell prompt (zsh's
zle flushes pending input); the kill assertion compared `.status` on the
channel's plain boolean. The bash journey waited for the view-full button
before expanding the card that contains it (upstream's v0.17.0 footer
redesign). All six journeys green on the built app. The scratch proof driver
(drive-terminal.mjs) was removed; the shipped driver owns the fixes.
