# Issue 06: terminal-utf8

Type: task
Status: resolved
Blocked by: —

Port 2e914db (#751): terminal shells default to LANG=C.UTF-8 when the host sets no
explicit locale (Windows ANSI codepage mangled non-ASCII filenames). Our
lib/terminal-manager.ts is shared with the electron terminal service, so the lib hunk +
tests apply directly.

## Answer

Resolved. Direct port, context identical. Gate: terminal-manager suite green (1 win32 skip).
