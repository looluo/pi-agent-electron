import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { npxEnvironment } = await jiti.import("./npx.ts");

test("an npx child gets the host environment without this server's own variables", () => {
  const base = {
    PATH: "/usr/bin",
    HTTPS_PROXY: "http://proxy.example:8080",
    GITHUB_TOKEN: "token",
    PI_WEB_PASSWORD: "secret",
    PORT: "30141",
    NODE_ENV: "production",
    NEXT_RUNTIME: "nodejs",
    FORCE_COLOR: "3",
  };
  const before = { ...base };

  assert.deepEqual(npxEnvironment(base), {
    PATH: "/usr/bin",
    HTTPS_PROXY: "http://proxy.example:8080",
    GITHUB_TOKEN: "token",
    FORCE_COLOR: "0",
  });
  assert.deepEqual(base, before);
});

// Fork (win32 packaging): prove runNpx/runNpm execute from an Electron runtime.
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const nodeRequire = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const electronPath = nodeRequire("electron");
const modulePath = fileURLToPath(new URL("./npx.ts", import.meta.url));
const jitiPath = nodeRequire.resolve("jiti");

async function runCliFromElectron(exportName) {
  const script = `
    const { createJiti } = require(${JSON.stringify(jitiPath)});
    const jiti = createJiti(${JSON.stringify(modulePath)});
    jiti.import(${JSON.stringify(modulePath)})
      .then((module) => module[${JSON.stringify(exportName)}](["--version"], { timeout: 10_000 }))
      .then(({ stdout }) => process.stdout.write(stdout))
      .catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  return execFileAsync(electronPath, ["-e", script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    timeout: 15_000,
  });
}

test("runNpx executes npx from an Electron runtime on Windows", {
  skip: process.platform !== "win32",
}, async () => {
  const { stdout } = await runCliFromElectron("runNpx");
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("runNpm executes npm from an Electron runtime on Windows", {
  skip: process.platform !== "win32",
}, async () => {
  const { stdout } = await runCliFromElectron("runNpm");
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});
