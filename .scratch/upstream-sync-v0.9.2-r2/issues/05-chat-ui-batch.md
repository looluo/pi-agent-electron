# Issue 05: chat-ui-batch

Type: task
Status: ready-for-agent
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
