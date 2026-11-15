---
name: verify-pi-agent-app
description: Drive the real Pi Agent App (Electron desktop app for the pi coding agent) to prove UI and IPC behavior the way a user does. Use to verify a change end-to-end in the built app, to reproduce a UI/IPC bug live, or to capture evidence (screenshots, transcripts, session files) for any user-facing feature.
---

# Verify Pi Agent App

Drive the built Electron app directly — launch it isolated, exercise a feature through the real UI and the real `window.pi` bridge, capture evidence, tear down. No HTTP port exists (ADR-0003): all driving goes through Playwright's Electron/CDP support and the preload bridge.

The shipped driver is `.claude/skills/verify-pi-agent-app/scripts/drive.mjs`. It reuses the launch/isolation recipe of `tests/e2e/helpers.ts` + `tests/e2e/setup.ts` but runs standalone, without the Playwright test runner.

## Launch

```bash
npm run build    # electron-vite build → out/main/main.mjs (+ preload + renderer)
```

Then let the driver launch — never start Electron yourself for a verification run. The driver:

1. Creates a fresh temp dir `/tmp/pi-verify-*` (per run, so instances never collide).
2. Stages an isolated agent home: copies `auth.json`, `models.json`, `settings.json`, `npm/` from the real agent home (`getAgentDir()`, e.g. `~/.pi/agent`) — never sessions. Credentials are needed for the live-LLM journey; the copy keeps package installs and UI state out of the user's home.
3. Launches `out/main/main.mjs` with `--user-data-dir <tmp>/user-data --remote-allow-origins=*`, `NODE_ENV=production`.

Ready means usable, not just "a window exists": the driver treats the app as ready only when the window title contains `Pi`, the `window.pi` bridge is exposed, and the shell renders visible text (the `shell` journey asserts exactly this). Fixture journeys instead wait for their seeded session row in the sidebar (up to 20 s).

## Doctor

```bash
node .claude/skills/verify-pi-agent-app/scripts/drive.mjs doctor
```

Read-only. Checks: `out/main/main.mjs` exists, `electron` + `@playwright/test` installed, real agent home exists, `auth.json` + `models.json` present (needed by `prompt-reply`), and warns when sources under `electron/` or `pi-web/src/` are newer than the build. Run this first whenever anything looks off.

## Drive

```bash
node .claude/skills/verify-pi-agent-app/scripts/drive.mjs <journey> [--keep] [--evidence-dir <dir>]
```

Journeys map 1:1 to the [feature map](./features/README.md): `shell`, `session-history`, `bash-full-output`, `terminal`, `prompt-reply`. Each exercises the real user path (sidebar clicks, localized buttons, the typed IPC bridge) — no test-only endpoints.

Driving conventions:

- Selectors follow `tests/e2e/*.spec.ts`: ARIA roles and text over coordinates; session rows are clickable divs matched by their first-message text; localized labels match zh-CN first with an English fallback (`/查看完整输出|View full output/i`) because the app runs zh-CN by default.
- The `window.pi` facade is the same contract the React UI uses (`sessionsList`, `agentNew`, `agentCommand`, `terminalCreate/Subscribe/Write/Kill`); driving through it exercises the real IPC handlers.
- For an unmapped path, write a one-off journey function in a scratch copy of the driver — don't edit the skill's journeys for a one-off, and don't weaken a journey to make it pass.
- The full spec suite (`npm run test:e2e`) remains the regression net; this skill is for proving a specific change in the real app.

## Evidence

Every run writes `tests/.artifacts/verify/<journey>-<timestamp>/` (gitignored, survives cleanup):

- `facts.json` — result (PASS/FAIL/SKIP), every step with timing, evidence paths, failure note.
- `*.png` — screenshots at the moments that matter (session opened, content loaded), not just the final screen.
- `terminal-transcript.txt` — raw PTY output frames for the `terminal` journey.

Proof standards: exercise the real user path; capture the action and the resulting state (the driver asserts the marker content is visibly rendered and checks side effects like the session `.jsonl` written under the isolated agent home); `prompt-reply` needs real credentials and hits the real LLM — it reports SKIP (exit 3) when `auth.json`/`models.json` are missing, which is a skip, not a pass.

## Cleanup

The driver tears down automatically (also on failure and on SIGINT): closes the Electron app it started (`app.close()`, never `pkill` by name), removes the `/tmp/pi-verify-*` run dir and any `pi-bash-verify-*.log` it wrote into the OS tmpdir. `--keep` preserves the run dir for debugging — remove it yourself afterwards. Evidence under `tests/.artifacts/verify/` always survives.

## Helpers

- `scripts/drive.mjs` — the driver shown above. Exit codes: `0` pass, `1` fail, `2` usage, `3` skipped. Run it from the repo root.

## Verified on

macOS dev machine (darwin) driving the built `out/` tree. The Windows packaging (`npm run package:dir`) is not part of this skill — it packages, it does not drive.
