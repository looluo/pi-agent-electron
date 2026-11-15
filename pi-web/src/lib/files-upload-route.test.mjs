import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream app/api/files/upload-route.test.mjs (this sync's
// "one file may use the whole 100MB limit" wave). Ours re-homes uploads onto
// typed IPC byte arrays, so the fixture drives filesUpload() directly.
const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-upload-route-")));
process.env.PI_CODING_AGENT_DIR = path.join(base, "agent");
test.after(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  fs.rmSync(base, { recursive: true, force: true });
});

const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  interopDefault: true,
  moduleCache: false,
});
const { filesUpload } = await jiti.import("../../../electron/main/services/files-upload.ts");
const { allowFileRoot } = await jiti.import("./file-access.ts");

function fixture() {
  const directory = fs.mkdtempSync(path.join(base, "files-"));
  allowFileRoot(directory);
  fs.writeFileSync(path.join(directory, "important.txt"), "original contents");
  return directory;
}

const upload = (directory, files, strategy = "overwrite") => filesUpload(directory, files, strategy);

test("one file may fill the 100MB limit, and one byte more is refused", async () => {
  const directory = fixture();
  const limit = 100 * 1024 * 1024;

  const atLimit = await upload(directory, [{ name: "full.bin", bytes: Buffer.alloc(limit) }], "error");
  assert.equal(atLimit.status, 200);
  assert.deepEqual(atLimit.body, { uploaded: ["full.bin"], skipped: [], errors: [] });
  assert.equal(fs.statSync(path.join(directory, "full.bin")).size, limit);

  const over = await upload(directory, [{ name: "over.bin", bytes: Buffer.alloc(limit + 1) }], "error");
  assert.equal(over.status, 413);
  assert.deepEqual(over.body, { error: "Uploads must total 100MB or less" });
  assert.deepEqual(fs.readdirSync(directory).sort(), ["full.bin", "important.txt"]);
});

test("files that pass the limit only together are refused before any is written", async () => {
  const directory = fixture();
  const half = Buffer.alloc(50 * 1024 * 1024 + 1);
  const response = await upload(directory, [
    { name: "first.bin", bytes: half },
    { name: "second.bin", bytes: half },
  ], "error");
  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { error: "Uploads must total 100MB or less" });
  assert.deepEqual(fs.readdirSync(directory), ["important.txt"]);
});
