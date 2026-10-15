# Issue 01: renderer-small-fixes

Type: task
Status: resolved
Blocked by: —

ed0eea9 (scrollMargin on extension-select options so keyboard nav clears the
scroller edge), fcd94bf (extension dialog titles render newlines like pi's
TUI + scrollable 50%-max header), 860698a (extension widget font-size follows
the chat font-size offset).

## Answer

Resolved. ed0eea9/fcd94bf via port-patch (clean); 860698a applied by hand to
globals.css (app/ path maps outside the script's defaults). Gate:
ChatWindow.extension-request suite green.
