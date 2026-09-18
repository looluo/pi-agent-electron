# Issue 04: apply-patch-diffs

Type: task
Status: resolved
Blocked by: (07)

e70c367 (#744): apply_patch (GPT-style) tool calls render as split diffs via
new lib/apply-patch.ts; returned failures mark the block as error even when
isError is unset; turn-written-files gains apply-patch input parsing.

## Answer

Resolved. First attempt (before 07) conflicted on MessageView's
tool-call-expansion import; after landing b42d3f4 the MessageView hunks apply
clean. Gate: apply-patch (137 lines), turn-written-files, MessageView suites
green.
