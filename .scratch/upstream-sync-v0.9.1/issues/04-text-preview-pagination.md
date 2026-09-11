# Issue 04: text-preview-pagination

Type: task
Status: resolved
Blocked by: —

Port 0e71201: lib/text-preview.ts chunked reads (UTF-8 boundary safe), FileViewer
load-more, i18n ×3, CSS. API route hunk re-homed: pifile:// read handler parses the
offset query (files-protocol passes it through) and returns {content, nextOffset,
truncated} instead of 413 over 256KB.

## Answer

Resolved. handleFilesGet gained rawOffset param; TEXT_PREVIEW_MAX_BYTES import dropped
from files.ts (still used by git-changes). Gate: text-preview suite green, typecheck.
