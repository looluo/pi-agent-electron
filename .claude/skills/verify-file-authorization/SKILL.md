---
name: verify-file-authorization
description: Formally check the pifile:// file-authorization gate (pi-web/src/lib/path-security.ts + paths.ts) with seeded generated inputs against the real code — lexical root containment, '..'-segment rejection (#748 symlink class), realpath containment with symlink escapes, and URL-segment reconstruction. Use when a change touches path-security.ts, paths.ts, file-access.ts, allowed-roots.ts, or the authorization logic in electron/main/services/files.ts.
---

# Verify the file-authorization gate

**The property.** A path requested through `pifile://local/...` may be authorized only if it denotes a location inside an allowed root (session cwds, project roots, operator-approved links, `~/pi-cwd-*`). **The harm if it breaks.** A compromised renderer (or repo-controlled content reaching the renderer origin) reads arbitrary files outside every workspace.

The promise lives in four pure functions plus one fs-backed one, exercised with generated inputs against the real code — no hand model:

| Check | Guards | Code |
|---|---|---|
| F1/F2 containment | `isPathWithinRoots` — resolve in the family picked by Windows absoluteness, case-fold only there, prefix at a segment boundary | `pi-web/src/lib/path-security.ts` |
| F3 dotdot-segment | `hasParentDirectorySegment` — every `..` segment flagged (realpath collapses `..` before following links; the filesystem applies it after — issue #748) | `path-security.ts` |
| F4 realpath containment | `isExistingPathWithinRoots` — real tree on disk: inside → allow, symlink-to-outside → deny, shared-prefix sibling → deny, nonexistent → deny, symlinked root (macOS `/tmp`) still works | `path-security.ts` |
| F5 segment reconstruction | `filePathFromApiSegments` — renderer-controlled URL segments always rebuild an absolute (or Windows-absolute) path, exactly per the documented join incl. bare `C:` → `C:/` | `pi-web/src/lib/paths.ts` |

`file-access.ts`'s `isFilePathAllowed`/`isExistingFilePathAllowed` delegate verbatim to these; `electron/main/services/files.ts` `handleFilesGet` is the caller that turns them into 403s.

## Run it

```bash
node .claude/skills/verify-file-authorization/scripts/check.mjs [--seed N] [--cases N]
```

Default seed is fixed: the same inputs and verdicts every time (~10 s). Use a new `--seed` to explore; use `--cases 20000` before declaring a fix for KNOWN-FINDING-1.

Exit codes: `0` every property holds · `1` NEW break beyond the documented finding — treat as a real defect until proven otherwise · `3` only KNOWN-FINDING-1 (below) — acceptable steady state.

## KNOWN-FINDING-1 (why exit 3 is the current baseline)

`isPathWithinRoots` accepts a UNC path (`\\server\share\...`) under a bare `\` root, because every UNC string starts with `\`. The bare root arises when a POSIX root `/` (or `//`) is re-resolved through `path.win32` (family switching) to `\`, the current-drive root; Node itself treats UNC and drive/bare paths as incomparable namespaces (`path.win32.relative` throws across them).

Reachability as shipped: an allowed root of `/` exists only if a session ran with cwd `/`; UNC targets reach the check only through URL-encoded backslashes in `pifile://local/` segments; and the second gate on the read path (`isExistingFilePathAllowed` at `electron/main/services/files.ts:321`) contains it on every platform — UNC paths fail `statSync` on macOS/Linux, and bare `\` roots cannot arise on Windows (cwds are drive paths). So it is a contract defect in the authorization function, not an exploitable read. Fix suggestion if the user asks: reject when the target resolves to UNC and the root does not (or compare root kinds as the check's oracle does). Do not fix product code unasked.

## Real bug or modeling error?

The oracle (`oracleWithin` in the script) is an independent implementation of the documented spec: segment-array prefix with Windows root-kind tracking (UNC / drive / bare). If the check fails:

- Soundness direction (`code=true oracle=false`, "ALLOWED a path outside the root") — treat as a real defect. Confirm by hand: does the printed target open a location outside the printed root on the platform you care about?
- Availability direction (`code=false oracle=true`) — check for a family/root-kind subtlety before reporting: the first draft of this check produced 9 such false findings because its oracle lost the UNC-vs-drive-vs-bare distinction; the corrected oracle encodes it. If Node's `path` module considers the two paths incomparable (e.g. `relative()` throws), the disagreement is probably a modeling error — fix the oracle and record why in this section.
- F4 failures are fs truth — the tree is built on disk in the run; reproduce with the printed paths.
- KNOWN-FINDING-1 counterexamples are exactly: code allows, oracle denies, target kind `unc`, root kind `bare`. Anything else fails the run.

## Coverage record (keep in step with the code)

- Files: `pi-web/src/lib/path-security.ts`, `pi-web/src/lib/paths.ts`
- Functions: `isPathWithinRoots`, `hasParentDirectorySegment`, `isExistingPathWithinRoots`, `filePathFromApiSegments` (plus `isWindowsAbsolutePath`/`toSlashPath` as used by the oracle)
- Callers covered by implication: `pi-web/src/lib/file-access.ts` (`isFilePathAllowed`, `isExistingFilePathAllowed`), `electron/main/services/files.ts` `handleFilesGet` authorization block
- Sync commit: `85efcd9` — the verification was confirmed to describe the code at this commit (proven: two scratch breaks — dropped segment boundary, disabled `..` guard — were each caught; reverts restored exit 3)

When a change touches the covered files: run the check before and after. If your change is an intended behavior change (not a bug), update the oracle and this document to the new spec, confirm both scratch-break classes still fail the check, and move the sync commit forward **only after** confirming the verification describes the code at the new commit.

## Why this tool

No practical SMT/model-checker runs on TypeScript source, and the promise is about every input string and filesystem shape — not event ordering (so TLA+ is not the fit). Per the trade-off, the check runs the real code (loaded with jiti, the repo's own test loader) against a seeded generator with an independent oracle: reproducible, dependency-free, ~10 s. Formal bounds: F1–F3/F5 hold for all generated inputs up to the case count (default 3000 per family; raise with `--cases`); F4 is exhaustive over its fixed tree.
