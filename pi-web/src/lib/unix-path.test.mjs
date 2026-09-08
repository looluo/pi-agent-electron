import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  const { createJiti } = await import("jiti");
  return createJiti(import.meta.url).import("./unix-path.ts");
}

test("mergePathEntries appends only missing entries, preserving order", async () => {
  const { mergePathEntries } = await loadSubject();
  assert.equal(mergePathEntries("/a:/b", "/c:/a:/d"), "/a:/b:/c:/d");
  assert.equal(mergePathEntries("", "/a:/b"), "/a:/b");
  assert.equal(mergePathEntries("/a", ""), "/a");
  // Empty segments (trailing colons) must not produce phantom entries.
  assert.equal(mergePathEntries("/a:", ":/b::"), "/a:/b");
  // Duplicates inside `extra` are collapsed too.
  assert.equal(mergePathEntries("/a", "/b:/b:/c"), "/a:/b:/c");
});

test("staticMacToolDirs lists the well-known macOS prefixes", async () => {
  const { staticMacToolDirs } = await loadSubject();
  const dirs = staticMacToolDirs("/Users/tester");
  assert.equal(dirs[0], "/opt/homebrew/bin");
  assert.ok(dirs.includes("/usr/local/bin"));
  assert.ok(dirs.includes("/Users/tester/.volta/bin"));
  assert.ok(dirs.includes("/Users/tester/Library/pnpm"));
});

test("parseShellEnvPath takes the last PATH line and tolerates noise", async () => {
  const { parseShellEnvPath } = await loadSubject();
  assert.equal(
    parseShellEnvPath("banners\nPATH=/usr/bin:/bin\nPATH=/opt/homebrew/bin:/usr/bin:/bin\nTERM=xterm"),
    "/opt/homebrew/bin:/usr/bin:/bin",
  );
  assert.equal(parseShellEnvPath("PATH=/nvm/bin:/usr/bin\n"), "/nvm/bin:/usr/bin");
  // No PATH line / implausible content → null.
  assert.equal(parseShellEnvPath("TERM=xterm\nHOME=/x"), null);
  assert.equal(parseShellEnvPath("PATH=\n"), null);
});
