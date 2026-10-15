# Issue 05: sessions-agent

Type: task
Status: resolved
Blocked by: —

Session/agent robustness + workspace UX: 6b0c6a5 (backpressure, adapted
to IPC), aed0f3c (wrapper gone once shutdown starts, bounded
session_shutdown), 34c8fdf (wait for a closing wrapper before reopen),
9ede521 (reap a run Stop cannot unwind), a3f24ea (deliver events to
every listener), e17d2cc (drop extension UI requests while the stream is
down), b8e0b71 (slim nested tool events + coalesce tool updates),
13bc2b0 (git decides what the file tree hides), f101948 (session-list
scroll work: memoized families + virtual indices), ea8a278 (subtle
scrollbars via useScrollbarVisibility), 390e70f (mobile composer above
the keyboard: useViewportHeight data-keyboard-open + css), 680db65
(folder picker creates directories), a0c00f3 (open workspace in the
system file manager, #907), 433d09e (dated pi-cwd via local date),
fe288c0 (review follow-ups #907/#946/#968).

## Answer

Resolved. Most via port-patch; notable adaptations:

- 6b0c6a5: upstream bounds an SSE stream's queued bytes. Our transport
  is IPC push with no ack signal, so the port applies the semantics we
  can honor: agent-events.ts coalesces tool_execution_update per tool
  call (150ms, b8e0b71's window), skips nested tool events, and bounds
  the pre-snapshot buffer (droppables dropped first, then oldest). The
  vestigial SSE stream file is synced to upstream for future diff
  cleanliness (dead code here — only referenced by a comment).
- 433d09e's default-cwd flow keeps our window.pi call but adopts the
  remember:false commitCustomPath semantics; sessionFamilies memoized.
- Mobile keyboard css block appended to globals.css (port loop had
  skipped app/*.css); MobilePwaLayout.test gained the settingsCssSource
  declaration with the fork path.

Gate: typecheck clean; npm test 1366/1368 (2 win32 skips, +64);
test:e2e 12/12.
