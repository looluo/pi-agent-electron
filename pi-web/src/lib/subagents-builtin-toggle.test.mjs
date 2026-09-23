// Port of f07d4a2's app/api/subagents/profiles/route.test.mjs, adapted to the
// Electron service: the builtin toggle branch lives in subagentsProfilesToggle.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../../electron/main/services/subagents.ts", import.meta.url),
  "utf8",
);
const toggleSource = source.slice(
  source.indexOf("export async function subagentsProfilesToggle"),
  source.indexOf("/** Port of app/api/subagents/profiles (DELETE)"),
);

test("toggling a built-in profile persists the name instead of writing a file", async () => {
  assert.match(toggleSource, /body\.scope === "builtin" \? "builtin" as const/);
  assert.match(toggleSource, /writeDisabledBuiltInSubagent\(source\.name, !body\.enabled\)/);
  assert.match(toggleSource, /profile: \{ \.\.\.source, enabled: body\.enabled \}/);
});

test("file-backed scopes keep the save-a-copy path", async () => {
  assert.match(toggleSource, /saveSubagentProfile\(cwd, scope, \{ \.\.\.profile, enabled: body\.enabled \}\)/);
});
