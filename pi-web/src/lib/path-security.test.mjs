import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false });
const { isPathWithinRoots, hasParentDirectorySegment } = await jiti.import("./path-security.ts");

// Lexical containment: isPathWithinRoots decides whether a pifile:// request
// path may pass the authorization gate in electron/main/services/files.ts.
test("path inside root is allowed across separator style and drive-letter case", () => {
  const roots = new Set(["/home/u/proj"]);
  assert.equal(isPathWithinRoots("/home/u/proj/src/lib/a.ts", roots), true);
  assert.equal(isPathWithinRoots("/home/u/proj", roots), true);
  assert.equal(isPathWithinRoots("C:\\work\\repo\\sub", new Set(["c:/work/repo"])), true);
});

test("path outside root is denied, including shared-prefix siblings", () => {
  const roots = new Set(["/home/u/proj", "/srv/app"]);
  assert.equal(isPathWithinRoots("/home/u/proj2/x", roots), false); // sibling sharing the prefix
  assert.equal(isPathWithinRoots("/srv/application", roots), false);
  assert.equal(isPathWithinRoots("/etc/passwd", roots), false);
  assert.equal(isPathWithinRoots("/home/u/proj/../proj2/x", roots), false); // climbs out lexically
});

// Regression (formal check KNOWN-FINDING-1): a posix "/" root re-resolves to
// the bare current-drive root "\" under win32 rules, and every UNC string
// starts with "\" — so the string-prefix check once accepted any
// \\server\share path under it. UNC and non-UNC roots are separate namespaces.
test("UNC paths are never contained by a bare root", () => {
  assert.equal(isPathWithinRoots("\\\\srv\\share\\secret", new Set(["/"])), false);
  assert.equal(isPathWithinRoots("//srv/share/secret", new Set(["//"])), false);
  assert.equal(isPathWithinRoots("\\\\srv\\share\\secret", new Set(["C:\\work"])), false);
  // …while a genuine UNC root still contains its own shares.
  assert.equal(isPathWithinRoots("\\\\srv\\share\\sub\\a.txt", new Set(["\\\\srv\\share"])), true);
  assert.equal(isPathWithinRoots("\\\\other\\share\\a.txt", new Set(["\\\\srv\\share"])), false);
});

test("hasParentDirectorySegment flags '..' segments in both families", () => {
  assert.equal(hasParentDirectorySegment("/root/sub/../../etc"), true);
  assert.equal(hasParentDirectorySegment("C:\\work\\..\\x"), true);
  assert.equal(hasParentDirectorySegment("/root/a..b/c"), false); // dots inside a name are fine
  assert.equal(hasParentDirectorySegment("/root/sub"), false);
});
