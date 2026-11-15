import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Ported from upstream app/api/sessions/export-route.test.mjs (this sync).
// Ours re-homes export onto the electron export service, so the assertions
// read that source.
const source = await readFile(new URL("../../../electron/main/services/export.ts", import.meta.url), "utf8");

test("session export uses a private per-request temp directory", () => {
  assert.match(source, /mkdtempSync\(join\(tmpdir\(\), "pi-web-export-"\)\)/);
  assert.doesNotMatch(source, /join\(tmpdir\(\), "pi-web-export"\)/);
});
