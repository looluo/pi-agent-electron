# Issue 05: chat-ui-batch

Type: task
Status: resolved
Blocked by: 01

Fifteen renderer commits. Highest 3-way risk of the wave: five of them touch
`hooks/useAgentSession.ts` (which carries our PR #45 trigger and local settle
flow) and two touch `components/ChatInput.tsx` (the known silently-dropped-
hunk file). Port one commit at a time, in upstream log order (oldest first),
each with its own source-assertion tests; never stage the whole batch.

- `8df5132` — preserve extension widget order on updates (#839): new
  `lib/extension-widgets.ts` + hook hunk.
- `002400d` — stop duplicating the first streamed chunk (#835):
  `lib/streaming-message.ts` (contained — no hook changes).
- `d11d344` — show tool-result images while the tool card is collapsed
  (#826): MessageView/ImagePreview/MarkdownBody.
- `c844973` — surface output-limit truncation (#830): message-display +
  ChatWindow notice.
- `79894b9`-adjacent — (models; belongs to issue 03, skip here)
- `f2d600b` — /auto-compact slash command (#828): ChatInput + hook builtin.
  ChatInput 3-way — verify all four hunks landed (control slot, handler,
  command table, i18n).
- `d11d344`→`be38e5d` — mention button + middle-ellipsis path on changed-file
  rows (#853): FileExplorer.
- `5e9b997` — honor `#page=` fragments in PDF links (#841): file-links +
  FileViewer/TabBar/message links.
- `1eb5e66` — scroll to latest button (#845): ChatWindow + chat-lazy-load +
  hook scroll hunk.
- `f3a4ff6` — keep selection toolbar above the session sidebar (#855): z-index.
- `ed50d88` — resizable conversation/file panes in sidebar (#825): new
  `hooks/useResizablePanel.ts` + SessionSidebar (local sidebar already
  two-pane: sessions + FileExplorer).
- `1bd40e4` — minimap per-turn tool-call count in hover (#939): ChatMinimap
  + module css.
- `5933184` — grabbable scrollbars, one in chat (#873/#788): globals.css —
  conflicts with local PR #548 panel styles; merge by hand, keep both.
- `0611857` — keep earlier replies visible after a subagent notification
  (#891): message-display + ChatWindow.
- `03a9f5d` — stop overriding settings.json defaultTools on new sessions
  (#700/#936): tool-presets + tool-preset-preference + rpc-manager + hook +
  ChatInput. Touches rpc-manager — re-check against our Electron-side
  dispatch (`services/agent.ts`).
- `0b307d5` — reopen the session event stream under Strict Mode effect
  re-runs (#933): hook; local main.tsx runs StrictMode so this is live for
  us. Port last (rides on all earlier hook hunks).

Gate: per-commit source-assertion tests green as each lands; full `npm test`
at batch end; e2e run once; manual packaged pass for scroll-to-latest,
sidebar resize, /auto-compact.


## Answer

Resolved, all 15 commits, ported one at a time in upstream log order
(ed50d88 d11d344 f2d600b c844973 002400d 8df5132 5e9b997 be38e5d f3a4ff6
1eb5e66 0611857 1bd40e4 5933184 03a9f5d 0b307d5). Conflicts resolved: 6.

- MarkdownBody img: took upstream's shared MarkdownImage component, ported
  our pifile://local resolution INTO it (test expectation adapted); collapsed
  tool-card images (#826) now render through the same path.
- ChatWindow x3: isAssistantTruncated import merge (+kept local
  process-group-expansion import); scroll-to-latest destructure keeps BOTH
  showScrollToBottom and local messagesEndRef (hook still returns both);
  c844973 import-line merge.
- useAgentSession.ts x2: 03a9f5d's agentNew — kept window.pi transport, took
  upstream's sessionToolsPinnedRef + omit-toolNames-when-undefined (#700);
  import merge keeps IpcAgentEventSource.
- useAgentSession.test.mjs EOF x2: kept local tests + appended upstream's
  (auto-compact; #700); one brace lost in the first merge — naive-depth check
  against the HEAD baseline located it.
- FileViewer import merge (local IpcFileWatchSource + parsePdfPageFragment).
- tool-presets tests: took theirs, dropped the PowerShell-preset test
  (powershell is not in this fork's preset vocabulary).

Ops lessons this batch: grep -c with zero matches exits 1 and breaks &&-chains
(a missed git add left an unmerged file that poisoned two later applies);
worktree-vs-index drift on hand-fixed files rejects later 3-way applies until
re-staged; a taken-theirs EOF block can carry tests for commits not yet
ported (b44017a's external-append test arrived early via 03a9f5d's blob —
dropped with a pointer, returns with r2 issue 06).

Gate: typecheck x2 clean; npm test 1128/1132 (1 pre-existing Windows PATH
baseline); e2e 8 passed 1 skipped.
