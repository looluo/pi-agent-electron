# Issue 06: reasoning-level-display

Type: task
Status: resolved
Blocked by: —

3f07a5f (#777): the thinking-level control stays visible (disabled) while a
turn streams and shows the level the runtime actually runs with; "auto" is an
uncommitted default (isAutoThinkingSelection) mirroring
isAutoModelSelection; live level adopted from agent state at turn start.
Squash-PR: its constituent fixes (UNC, dialog titles, scroller edge, …) were
ported separately first (issues 01/02).

## Answer

Resolved. useAgentSession/ChatWindow/i18n/models-cache/model-scope applied via
port-patch; the app/api/models route's `defaultThinkingLevel` re-homed onto
the `pi:models` IPC response (models-auth.ts loadModels + EMPTY_MODELS).
Four ChatInput hunks were silently dropped by --3way on drifted context and
re-applied by hand after ChatInput.streaming-thinking.test.mjs caught them.
model-loading.test.mjs conflict resolved per our jiti harness (window.pi
models mock kept; upstream fetch mock + new refs merged). Gate: 962 unit
tests, model-loading/model-scope-startup/ChatInput suites green, 12/12 e2e.
