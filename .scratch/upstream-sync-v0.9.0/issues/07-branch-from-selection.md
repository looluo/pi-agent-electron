# Issue 07: branch-from-selection

Type: task
Status: resolved
Blocked by: 03 04

Port c0abfc2 (#698): branch conversations from selected text. ChatWindow +237 lines, ChatInput selection capture, AppShell/SettingsPanel wiring. Verify SDK 0.85.1 fork API on our rpc-manager.

## Answer

Resolved in be35317. c0abfc2 ported in full (renderer + lib + rpc-manager
forkSession plumbing + three-locale keys). E2E quoted-branch spec not
imported (upstream e2e/chat-appearance.mjs + quoted specs ride their
Playwright web harness; our Electron e2e suite keeps its 7 specs — behavior
covered by ChatWindow.quoted-branch.test.mjs). Gate: typecheck clean,
813/815 unit.
