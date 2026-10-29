import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// "Ask here" inserts the quote and leaves the caret at its end so the question
// is typed after it. `window.getSelection().removeAllRanges()` clears the
// focused textarea's selection too and drops the caret to offset 0 (#1319).
test("asking about a selection in the current chat keeps the caret at the quote's end", async () => {
  // Fork: no demo/ copy ships here; guard the one component we build.
  for (const path of ["../components/ChatWindow.tsx"]) {
    let source;
    try {
      source = await readFile(new URL(path, import.meta.url), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const body = source.match(/const askSelectionHere = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
    assert.ok(body, `expected askSelectionHere in ${path}`);
    const code = body[0].replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(
      code,
      /removeAllRanges\s*\(/,
      `${path}: inserting already collapses the page's selection, and removing ranges afterwards resets the composer's caret`,
    );
  }
});
