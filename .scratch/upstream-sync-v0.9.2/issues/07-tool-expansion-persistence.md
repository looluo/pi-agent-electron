# Issue 07: tool-expansion-persistence

Type: task
Status: resolved
Blocked by: —

b42d3f4 (#743): tool blocks the user opened stay expanded across streaming
updates — lib/tool-call-expansion.ts persists per-toolCallId expansion.

## Answer

Resolved. port-patch clean (lib + MessageView). Coexists with our local
26be91e default-collapse (different axis: per-group collapse default vs
per-toolCallId user override). Gate: tool-call-expansion suite green.
