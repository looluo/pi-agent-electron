# Pi Agent App verification map

This directory is the maintained source for verifying the user-facing behavior of the Pi Agent App (Electron). Read this index before driving the app, then use the matching feature file as the recipe. The shipped driver is `../scripts/drive.mjs`; its journey names appear in each feature file.

## Baseline preconditions

- `npm run build` has produced `out/main/main.mjs`; `drive.mjs doctor` passes (or only warns about staleness you just fixed by building).
- The driver stages its own isolated agent home and user-data dir per run — never drive an instance you did not start through the driver.
- Live-LLM journeys additionally need `auth.json` + `models.json` in the real agent home (`~/.pi/agent`); without them `prompt-reply` reports SKIP.

## Driving conventions

- Start every journey from the driver's clean baseline; fixture journeys seed their own session.
- Prefer ARIA roles, accessible names, and stable text over CSS selectors or DOM position.
- Localized labels: match zh-CN first with an English fallback (the app runs zh-CN by default).
- Treat every command as literal. Keep markers and flags unchanged.
- Do not weaken a journey to make it pass. Report the failure and put the reason in the feature's Gotchas.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen: the driver screenshots each step transition and writes `facts.json`.
- Side effects (session `.jsonl` written, PTY output frames) are asserted alongside what is visible.
- Evidence lives under `tests/.artifacts/verify/` and survives cleanup.
- Report a skipped journey with its unmet precondition; never report it as verified through a different path.

## Features

- [App shell](./app-shell.md) — window, preload bridge, sidebar/chat shell from an empty data dir.
- [Session history](./session-history.md) — sidebar lists saved sessions; opening one loads its context.
- [Prompt → reply](./prompt-reply.md) — live LLM round trip through the facade the UI uses.
- [Terminal](./terminal.md) — workspace PTY over typed IPC.
- [Bash full output](./bash-full-output.md) — truncated tool-call log loads over IPC from the UI button.
