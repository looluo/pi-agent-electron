import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { importPiSdkInternals, loadPiSdkInternals } = await jiti.import("./pi-sdk-internals.ts");

test("the internals load with the cwd a packaged Electron app has", async () => {
  // Finder/Dock launches run the main process with cwd "/"; the SDK is
  // resolved from this module's own location, not from the cwd.
  const result = await importPiSdkInternals({ environment: {}, cwd: "/" });
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  assert.equal(typeof result.McpServerConnection, "function");
  assert.equal(
    result.packageDir.endsWith("node_modules/@earendil-works/pi-coding-agent"),
    true,
    result.packageDir,
  );
});

test("the cached load answers the same as a fresh import", async () => {
  const cached = await loadPiSdkInternals();
  assert.equal(cached.ok, true, cached.ok ? "" : cached.reason);
  assert.equal(cached.packageDir, (await importPiSdkInternals({ environment: {}, cwd: "/" })).packageDir);
});

test("PI_PACKAGE_DIR keeps MCP off: it would move getPackageDir()", async () => {
  const result = await importPiSdkInternals({ environment: { PI_PACKAGE_DIR: "/elsewhere" }, cwd: process.cwd() });
  assert.equal(result.ok, false);
  assert.match(result.reason, /PI_PACKAGE_DIR is set/);
});
