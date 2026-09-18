# Issue 02: unc-file-paths

Type: task
Status: resolved
Blocked by: —

c04bab7: encodeFilePathForApi folds a `//` UNC root into the first segment
(`%2F%2Fhost`) so it survives the URL round-trip; decoder side
(filePathFromApiSegments + isWindowsAbsolutePath) was already identical in our
fork — only the encoder and tests were missing.

## Answer

Resolved. Relevant to us beyond upstream parity: we ship a Windows build and
UNC cwds travel over `pifile://local/<segments>` the same way. port-patch
clean (file-paths.ts was byte-identical to upstream pre-fix). Gate:
file-paths + paths suites green (16 tests).
