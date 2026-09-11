# Issue 09: renderer-fixes-2

Type: task
Status: resolved
Blocked by: —

Six pure renderer fixes: dab9850 (@ picker keyboard wrap, #769), 1b88ec7
(@ picker visible-area clamp, #768), 4787a14 (streaming output preserved when
opening an active session), f607816 (enabledModels leftover warnings, #770),
a74aef8 (sidebar=collapsed query param, #712), 894c735 (zh worktree labels).

## Answer

Resolved. ChatInput test import conflict resolved per our jiti harness
(cycleListIndex added to the static-import destructure); 1b88ec7's component
hunk re-applied after an atomic batch rollback. Gate: ChatInput,
streaming-message, model-scope, initial-navigation suites green.
