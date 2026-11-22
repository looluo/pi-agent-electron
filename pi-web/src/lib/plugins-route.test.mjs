import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = await mkdtemp(join(tmpdir(), "pi-web-plugin-route-"));
const agentDir = join(root, "agent");
const cwd = join(root, "project");
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = agentDir;
await mkdir(join(agentDir, "extensions"), { recursive: true });
await mkdir(cwd);
await writeFile(join(agentDir, "extensions", "rtk.ts"), "export default () => {};\n");

// Port of upstream app/api/plugins/route.test.mjs against the Electron
// plugins service (pluginsList replaces the route's GET handler).
const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } });
const { allowFileRoot } = await jiti.import("./file-access.ts");
const { pluginsAction, pluginsList } = await jiti.import("../../../electron/main/services/plugins.ts");
allowFileRoot(cwd);

after(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(root, { recursive: true, force: true });
});

test("lists auto-discovered top-level extensions", async () => {
  const response = await pluginsList(cwd);
  const body = response.body;

  assert.equal(response.status, 200);
  assert.deepEqual(body.packages, []);
  assert.deepEqual(body.standaloneExtensions, [{
    kind: "extension",
    name: "rtk",
    path: join(agentDir, "extensions", "rtk.ts"),
    relativePath: "extensions/rtk.ts",
    scope: "global",
    enabled: true,
  }]);
  assert.equal(body.totals.extensions, 1);
});

test("reports the package description from package.json", async () => {
  const packageDir = join(root, "pkg-with-description");
  await mkdir(join(packageDir, "extensions"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({
    name: "pkg-with-description",
    version: "1.2.3",
    description: "Adds descriptions to the Plugins panel.",
  }));
  await writeFile(join(packageDir, "extensions", "index.ts"), "export default () => {};\n");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [packageDir] }));

  const response = await pluginsList(cwd);
  const body = response.body;

  assert.equal(response.status, 200);
  const installed = body.packages.find((pkg) => pkg.source === packageDir);
  assert.ok(installed, "configured package is listed");
  assert.equal(installed.description, "Adds descriptions to the Plugins panel.");
});

// The panel's per-package switch sends { action, source, scope } — the
// single-package form. The bulk form (eceac13) must be gated on `packages`
// being present, not on the action: gating on the action 400'd every single
// disable with "packages must be a list of {source, scope}" (bug found in the
// wild on the v0.18.0 tree; upstream's route gates on packages !== undefined).
test("a single package is disabled and re-enabled through the action service", async () => {
  const packageDir = join(root, "pkg-single-switch");
  await mkdir(join(packageDir, "extensions"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ name: "pkg-single-switch", version: "0.0.1" }));
  await writeFile(join(packageDir, "extensions", "index.ts"), "export default () => {};\n");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [packageDir] }));

  const disable = await pluginsAction({ action: "disable", source: packageDir, scope: "global", cwd });
  assert.equal(disable.status, 200, JSON.stringify(disable.body));
  let listed = (await pluginsList(cwd)).body;
  assert.equal(listed.packages.find((pkg) => pkg.source === packageDir)?.disabled, true);

  const enable = await pluginsAction({ action: "enable", source: packageDir, scope: "global", cwd });
  assert.equal(enable.status, 200, JSON.stringify(enable.body));
  listed = (await pluginsList(cwd)).body;
  assert.notEqual(listed.packages.find((pkg) => pkg.source === packageDir)?.disabled, true);
});

test("the bulk form still answers per-package results, and only for enable/disable", async () => {
  const packageDir = join(root, "pkg-bulk-switch");
  await mkdir(join(packageDir, "extensions"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ name: "pkg-bulk-switch", version: "0.0.1" }));
  await writeFile(join(packageDir, "extensions", "index.ts"), "export default () => {};\n");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [packageDir] }));

  const bulk = await pluginsAction({
    action: "disable",
    cwd,
    packages: [{ source: packageDir, scope: "global" }],
  });
  assert.equal(bulk.status, 200, JSON.stringify(bulk.body));
  assert.equal(Array.isArray(bulk.body.results), true);
  assert.equal(bulk.body.results[0].error, undefined);
  const listed = (await pluginsList(cwd)).body;
  assert.equal(listed.packages.find((pkg) => pkg.source === packageDir)?.disabled, true);

  const misuse = await pluginsAction({ action: "update", cwd, packages: [{ source: packageDir, scope: "global" }] });
  assert.equal(misuse.status, 400);
  assert.match(misuse.body.error, /only supported by enable and disable/);
});
