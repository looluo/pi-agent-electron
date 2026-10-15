# Issue 02: security-paths

Type: task
Status: resolved
Blocked by: —

Three security/authorization fixes:

- b3c7255: session file-reference authorization no longer trusts tool
  results from non-coding tools (MCP/codemode/third-party relay
  remote-controlled text). Only coding tools + our subagent control tools
  report authorizable paths; others contribute just their fullOutputPath
  spill file and their ctx.executeTool() nested coding-call arguments.
- 687af27 (#748/#1018): `..` segments are refused before authorization in
  every file surface (the filesystem applies `..` after following links,
  realpath collapses it before — `link/../x` escapes the roots); directory
  links leading outside the roots are listed with outsideLinkTarget and an
  operator-approved "Allow browsing" flow (allow-link) that widens the
  in-memory roots exactly like cwd-validate does.
- 82d1f54: worktree removal matches git's real-path listing.

## Answer

Resolved. b3c7255 + lib-side of 687af27 (linked-directory.ts, path-security,
i18n) via port-patch; 82d1f54 with a test-conflict resolution that dropped
two #1007 tests (worktreeRemovalRequiresForce — arrives with 4cc0770 in the
chat batch).

Transport re-homing for 687af27 (the batch's whole point): the route's
POST ?type=allow-link became a pifile:// protocol POST (protocol.handle
carries methods/bodies; fetch supportFetchAPI on the privileged scheme) —
files-protocol routes POST+allow-link to the new handleFilesAllowLink,
handleFilesGet refuses hasParentDirectorySegment before authorization and
annotates list responses with withOutsideLinkTargets. FileExplorer gained
the allow-link UI with the fetch rewritten to pifile://local/...

Route test re-homed as lib/files-allow-link-route.test.mjs (drives the
electron service directly, plugins-route convention); FileExplorer
SSR test ported as-is (TreeNode gained the export upstream added).

Gate: typecheck clean; npm test 1213/1215 (+34, 2 win32 skips);
test:e2e 12/12.
