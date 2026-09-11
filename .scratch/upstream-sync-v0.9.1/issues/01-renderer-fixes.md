# Issue 01: renderer-fixes

Type: task
Status: resolved
Blocked by: —

Port a26cc68 (escaped backticks in inline code), 5173f6a (#537 rich-text paste links),
d10988d (duplicate builtin command submissions), f4a700d (#699 extension prompts as
markdown). Direct renderer ports; ChatInput.test import conflict resolved in favor of
our jiti harness (no dual-React workaround).

## Answer

Resolved. All four via port-patch (lib/components); 5173f6a's test import block kept
our static React import + added replaceLinksWithMarkdown. Gate: suites green.
