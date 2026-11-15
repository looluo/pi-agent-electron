import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream app/api/files/range-route.test.mjs (this sync). Ours
// re-homes the route onto handleFilesGet behind pifile://, so the fixture
// drives that directly; the range semantics are the route's own.
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-range-")));
process.env.PI_CODING_AGENT_DIR = path.join(root, "agent");
test.after(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  fs.rmSync(root, { recursive: true, force: true });
});
const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  interopDefault: true,
  moduleCache: false,
});
const { handleFilesGet } = await jiti.import("../../../electron/main/services/files.ts");
const { allowFileRoot } = await jiti.import("./file-access.ts");
allowFileRoot(root);

test("download ranges require at least one bound and preserve valid suffix/open ranges", async () => {
  const file = path.join(root, "download.txt");
  fs.writeFileSync(file, "abcdef");
  const request = (range) => handleFilesGet(file, "download", null, range);
  const invalid = await request("bytes=-");
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("content-range"), "bytes */6");
  for (const [range, content] of [["bytes=-2", "ef"], ["bytes=2-", "cdef"], ["bytes=1-3", "bcd"]]) {
    const response = await request(range);
    assert.equal(response.status, 206);
    assert.equal(await response.text(), content);
  }
});
