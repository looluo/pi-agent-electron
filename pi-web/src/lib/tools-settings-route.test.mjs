import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream app/api/tools/settings/route.test.mjs (this sync's
// builtinTools wave). Ours re-homes the route onto the electron tools-settings
// service, so the fixture drives toolsSettingsGet/Put with plain arguments.
const base = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-tool-settings-route-"));
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = path.join(base, "agent");
fs.mkdirSync(process.env.PI_CODING_AGENT_DIR);

test.after(() => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  fs.rmSync(base, { recursive: true, force: true });
});

const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  interopDefault: true,
  moduleCache: false,
});
const { toolsSettingsGet, toolsSettingsPut } = await jiti.import("../../../electron/main/services/tools-settings.ts");

const settingsPath = path.join(base, "agent", "settings.json");
const DEFAULTS = ["read", "edit", "write", "bash"];
const body = async (result) => result.body;

test("reports the built-in tools beside the Code mode choice", async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ defaultModel: "m" }));
  const initial = await toolsSettingsGet();
  assert.equal(initial.status, 200);
  assert.deepEqual((await body(initial)).builtinTools, DEFAULTS);
});

test("saves the built-in tools, keeping the other defaultTools entries", async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ defaultModel: "m", defaultTools: ["+codemode"] }));
  const saved = await toolsSettingsPut({ builtinTools: ["read", "grep", "bash"] });
  assert.equal(saved.status, 200);
  assert.deepEqual((await body(saved)).builtinTools, ["read", "grep", "bash"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, "utf8")), { defaultModel: "m", defaultTools: ["+codemode", "-edit", "-write", "+grep"] });

  const restored = await toolsSettingsPut({ builtinTools: DEFAULTS });
  assert.equal(restored.status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, "utf8")), { defaultModel: "m", defaultTools: ["+codemode"] });
});

test("rejects tool lists that are not names from the settings list", async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ defaultModel: "m" }));
  for (const builtinTools of [["read", "lookup"], "read", null]) {
    const refused = await toolsSettingsPut({ builtinTools });
    assert.equal(refused.status, 400, JSON.stringify(builtinTools));
    assert.match(refused.body.error, /builtinTools must list names from/);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, "utf8")), { defaultModel: "m" });
});

test("a request must name exactly one change", async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ defaultModel: "m" }));
  for (const changes of [{ codemode: "always", enabled: true }, { codemode: "always", builtinTools: [] }, { builtinTools: ["read"], codemodeInlineBudget: 1000 }, {}]) {
    const refused = await toolsSettingsPut(changes);
    assert.equal(refused.status, 400, JSON.stringify(changes));
    assert.match(refused.body.error, /Send one of/);
  }
});
