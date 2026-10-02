# Issue 08: tools-codemode

Type: task
Status: resolved
Blocked by: —

1c387b4 (Code mode choice written through the tools-settings endpoint;
resolveDefaultToolEntries + codemode-settings), 9dc822e (codemode call
rendered as its script and the calls it made — CodemodeToolView),
ba044f9 (codemode, tool-search and mcp built-ins loaded in normal
sessions as replaceable built-ins under the CLI's names).

## Answer

Resolved. powershell-settings + codemode-settings + regular-file +
key-serializer + jsonc + shell-words taken from upstream (the
defaultTools +/- modifier rule of pi 0.99). The tools-settings route's
codemode half re-homed onto pi:tools:settings:put — the channel now
takes { enabled } XOR { codemode }, reads both values back, and
ToolSettingsResponse carries codemode. CodemodeToolView and the
codemode message rendering ported with MessageView.

Gate: typecheck clean; npm test 1520/1526 (6 skips); e2e 12/12.
