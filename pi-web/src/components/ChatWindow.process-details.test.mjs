import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Source-shape guard for the process-details group's expansion persistence
// (history-collapse-ux ticket 03, re-landed on upstream's f47c38a component).
const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("ProcessDetailsGroup persists manual expand/collapse per session", async () => {
  // Initial state reads the store with defaultExpanded as fallback…
  assert.match(
    source,
    /useState\(\(\) => \(\s*persistence \? isProcessGroupExpanded\(persistence\.sessionId, persistence\.anchorId, defaultExpanded\) : defaultExpanded\s*\)\)/,
  );
  // …and the toggle writes back, but only when persistence is attached.
  assert.match(
    source,
    /if \(persistence\) setProcessGroupExpanded\(persistence\.sessionId, persistence\.anchorId, next\);/,
  );
  // The call site attaches it whenever the session id is known, keyed by the
  // group's anchor entry id.
  assert.match(
    source,
    /persistence=\{session\?\.id \? \{ sessionId: session\.id, anchorId \} : undefined\}/,
  );
});

test("reveal stays in-memory: the layout effect must not write the store", async () => {
  const fn = source.indexOf("function ProcessDetailsGroup");
  const start = source.indexOf("useLayoutEffect(() => {", fn);
  const end = source.indexOf("}, [reveal]);", start);
  assert.ok(start !== -1 && end !== -1, "reveal effect not found");
  const effect = source.slice(start, end);
  assert.match(effect, /if \(reveal\) setExpanded\(true\);/);
  assert.doesNotMatch(effect, /setProcessGroupExpanded/);
});
