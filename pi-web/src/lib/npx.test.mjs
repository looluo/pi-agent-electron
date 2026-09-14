import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const electronPath = require("electron");
const modulePath = fileURLToPath(new URL("./npx.ts", import.meta.url));
const jitiPath = require.resolve("jiti");

test("runNpx executes npx from an Electron runtime on Windows", {
  skip: process.platform !== "win32",
}, async () => {
  const script = `
    const { createJiti } = require(${JSON.stringify(jitiPath)});
    const jiti = createJiti(${JSON.stringify(modulePath)});
    jiti.import(${JSON.stringify(modulePath)})
      .then(({ runNpx }) => runNpx(["--version"], { timeout: 10_000 }))
      .then(({ stdout }) => process.stdout.write(stdout))
      .catch((error) => { console.error(error); process.exitCode = 1; });
  `;

  const { stdout } = await execFileAsync(electronPath, ["-e", script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    timeout: 15_000,
  });

  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});
