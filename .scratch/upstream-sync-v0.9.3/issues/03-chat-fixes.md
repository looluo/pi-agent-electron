# Issue 03: chat-fixes

Type: task
Status: resolved
Blocked by: —

The renderer/chat batch: streaming reasoning change (d0bf6be, committed
separately as 464babf), 0bae9b6 collapse-once-answered + 69882b9 mid-page
anchor grouping (both reconciled with local 26be91e), 19774b8 fork while
running (#1023), 94c1f5c edit drafts, 7303179 branch-on-send (#1009),
70470ca extension dialog queueing, faeff03 typed line breaks (#1015),
fd037e4 list continuation (#884), 4a5081a CJK autolink (#971/#972),
6a97d0b currency+inline math (#976), 46b5235 dialog title shrink (#961),
f5e768e Stop ends survivor-held commands (#1016), 342fc9a
truncation→compact (#968), 2e66e40 compaction reporting (#1008),
6f92983 system prompt before first message (#974), 4cc0770 worktree
force-removal confirm (#1007).

## Answer

Resolved. Reconciliation decisions:

- 0bae9b6/69882b9 vs local 26be61e: adopted upstream's answer-aware
  default (unanswered turns expand, answered collapse) + re-key on
  answer availability; the local per-session persisted expansion
  survives, with isProcessGroupExpanded gaining a fallback param so an
  unstored group inherits defaultExpanded instead of forcing collapsed.
  ProcessDetailsGroup anchorId now keys off groupStartIdx (mid-page
  turns without anchors group from index 0).
- 7303179 vs fork-local onNavigate threading (pre-v0.9.0, 648e953):
  upstream's edit-then-branch-on-send replaces it — MessageView's edit
  button calls onEditContent(message, entryId) directly, handleSend
  navigates via handleNavigateRef only when a pending edit exists.
  ChatWindow's fork-local memoized handleEditContent wrapper deleted in
  favor of the hook's; the hook returns cancelEdit only while an edit
  is pending.
- 94c1f5c before 7303179 (log order) brought later-state hunks early:
  the ChatInput defaultModel destructure conflict was deferred to issue
  06 (6a1246e owns Props+UI); worktree's #1007 tests arrived with
  342fc9a's merge and pass once 4cc0770's implementation lands (same
  batch).

Gate: typecheck clean; npm test 1269/1271 (2 win32 skips);
BranchNavigator+rpc-manager 34/34; test:e2e 12/12.
