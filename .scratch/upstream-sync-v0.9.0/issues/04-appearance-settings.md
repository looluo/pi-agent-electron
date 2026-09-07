# Issue 04: appearance-settings

Type: task
Status: resolved
Blocked by: 03

Display settings cluster: 039e843 chat width/font-size (ChatAppearance + settings.css + SettingsPanel), 092b5d4 simplify+resets, 67d65a5 process-grouping+ThinkingIcon, 8aec7a1 thinking-expand-default. Interdependent ChatWindow/MessageView/SettingsPanel changes; port as unit, adapt CSS var wiring to our globals.css if diverged.

## Answer

Resolved in be35317 (together with issue 07 — c0abfc2 had to land first
because b8d0043/8463025 restyle its settings.chat keys; applied out of
chronological order and the duplicate section collapsed back to upstream's
unified form). zh-TW gained the authoritative Traditional block. Gate:
typecheck clean, 813/815 unit.
