# Issue 03: renderer-fix-batch

Type: task
Status: resolved
Blocked by: 01

Apply-only batch: 07dd093 wide-md-tables, 18923e6 model-selector-on-fail, 80a44a5 thinking-borders, 8c18f21 icon-bg, cc1394d ext-label-scroll, 2e1c402 widget-trigger-area, 2356904 ext-dialog-keyboard, 6d7c5e0 image-model-warning, abb74bf alt-enter-followup, 0ddb21f minimap-compaction, 55485b9 highlight-cache, f3925bf mermaid-preview, 7047460+b8d0043+8463025 style triple, 6ac72b2 i18n-tooltips (3-locale parity), ff63346 skill-frontmatter fences (shared with electron skills service), 430fe4d reading-positions, 77ffe3c unsent-drafts, 5f8f47b windowed-sidebar, 7c5f4e6 ext-dialog-collapse (creates lib/rpc-manager-extension-ui.test.mjs — after creating it, ALSO apply 06ed14f's hunk to that file: fake session gains abortCompaction/abortBranchSummary, required by SDK 0.85.1).

## Answer

Resolved in f67c1c8. 19 of 21 commits applied; b8d0043 + 8463025 moved to
issue 04 (they restyle the ChatAppearance cluster that does not exist here
yet); 8c18f21 recorded n/a (favicon/PWA icons only). Key lessons: (1) git
apply --3way is atomic per invocation — apply per-file when a commit touches
files we do not carry; (2) clear unmerged index entries with git add before
the next --3way or it fails with misleading "does not exist in index";
(3) upstream test preambles (jiti React imports, fetch mocks, Response
shapes) need fork adaptation to ESM imports + window.pi mocks; (4)
app/globals.css hunks are outside port-patch.sh default path set — remap
a/app/globals.css -> a/globals.css manually.
Gate: typecheck clean, 802/804 unit (1 known baseline), E2E pending final
sync gate.
