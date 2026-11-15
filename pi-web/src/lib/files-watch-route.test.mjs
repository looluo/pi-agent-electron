import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream app/api/files/watch-route.test.mjs (this sync's
// heartbeat wave). Ours re-homes the watch onto openFileWatch pushing over
// pi:file-watch:*, so the fixture drives it with plain callbacks.
const base = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-watch-route-"));
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
const { openFileWatch } = await jiti.import("../../../electron/main/services/files.ts");
const { FILE_WATCH_HEARTBEAT_MS } = await jiti.import("./file-version.ts");

test("a watch sends a ping event each heartbeat until the client goes", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const file = path.join(base, "heartbeat.txt");
  fs.writeFileSync(file, "one");
  const events = [];
  const stop = openFileWatch(file, (eventName) => events.push(eventName), () => {});
  t.mock.timers.tick(FILE_WATCH_HEARTBEAT_MS);
  stop();
  assert.deepEqual(events.filter((name) => name === "ping").length, 1);
  // Stopped watches stop pinging.
  t.mock.timers.tick(FILE_WATCH_HEARTBEAT_MS * 3);
  assert.deepEqual(events.filter((name) => name === "ping").length, 1);
});
