# Issue 07: subagents-fixes

Type: task
Status: resolved
Blocked by: —

162a749 (`ext:` selectors resolve against real extension sources, #946),
2a71c57 (background report says when it comes from a resumed run, #991),
00156d5 (a run orphaned by a restart reports as interrupted, #990),
c8ff7e8 (collected-result mark keyed by run, not session, #987/#989),
62542da (subagent control tools registered as model-only), 73104ba
(withExtensionTools stops forcing inactive tools on — the
resolveActiveToolNames rework), 18758b7 (carry only active tools; keep
session tools across navigation).

## Answer

Resolved. lib-side applied via port-patch; the rpc-manager rework
(73104ba + 18758b7) needed hand porting because its 3-way context had
drifted beyond fallback:

- withExtensionTools replaced by exported resolveActiveToolNames: a
  selection replaces only coding tools; carried tools must still be
  registered and not hidden; no blanket re-activation of extension
  tools.
- setActiveToolSelection gains the carry parameter; navigate_tree and
  the extension-command navigateTree route through the new
  navigateTreeKeepingToolSelection (branch loadout re-applies the
  pinned selection; SESSION_TOOL_NAMES = codemode, tool_search, and the
  subagent control tools survive navigation).
- get_tools filters hidden (withdrawn) tools.
- Tool-exposure test suites (+ integration) ported from upstream; 19/19.

Gate: typecheck clean; npm test 1415/1417 (+38); test:e2e 12/12.
