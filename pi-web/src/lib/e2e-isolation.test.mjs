import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: setup } = await jiti.import("../../../../tests/e2e/setup.ts");
const { createAgentHomeFixture } = await jiti.import("../../../../tests/e2e/helpers.ts");

function sourceHome(t) {
  const directory = mkdtempSync(join(tmpdir(), "e2e-isolation-test-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousTestDir = process.env.PI_E2E_TEST_DIR;
  t.after(() => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    if (previousTestDir === undefined) delete process.env.PI_E2E_TEST_DIR;
    else process.env.PI_E2E_TEST_DIR = previousTestDir;
    rmSync(directory, { recursive: true, force: true });
  });
  process.env.PI_CODING_AGENT_DIR = directory;
  process.env.PI_E2E_TEST_DIR = join(directory, "outer-run");
  return directory;
}

test("E2E setup copies configuration, not real sessions, and teardown removes its test data", async (t) => {
  let cleanup;
  t.after(() => cleanup?.());
  const source = sourceHome(t);
  const files = {
    "auth.json": '{"fixture-provider":{"type":"api_key","key":"test-only"}}',
    "models.json": "{}",
    "settings.json": '{"packages":["npm:fixture"]}',
    "npm/package.json": '{"name":"installed-fixture"}',
    "sessions/keep.jsonl": '{"type":"session","id":"keep"}\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const path = join(source, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  cleanup = await setup();
  const testDirectory = process.env.PI_E2E_TEST_DIR;
  const agent = process.env.PI_CODING_AGENT_DIR;
  assert.notEqual(agent, source);
  assert.equal(agent, join(testDirectory, "agent"));
  assert.equal(existsSync(join(agent, "sessions")), false);
  for (const name of ["auth.json", "models.json", "settings.json", "npm/package.json"]) {
    assert.equal(readFileSync(join(agent, name), "utf8"), files[name]);
  }
  mkdirSync(join(agent, "sessions"));
  writeFileSync(join(agent, "sessions", "test.jsonl"), "test session");
  writeFileSync(join(agent, "settings.json"), "changed only by test");
  cleanup();
  assert.equal(existsSync(testDirectory), false);
  assert.equal(process.env.PI_CODING_AGENT_DIR, source);
  assert.equal(process.env.PI_E2E_TEST_DIR, join(source, "outer-run"));
  for (const [name, content] of Object.entries(files)) {
    assert.equal(readFileSync(join(source, name), "utf8"), content);
  }
});

test("session fixtures live in the agent home passed to Electron, not the runner's agent home", async (t) => {
  let cleanup;
  t.after(() => cleanup?.());
  const source = sourceHome(t);
  cleanup = await setup();
  const runnerHome = process.env.PI_CODING_AGENT_DIR;
  const entry = JSON.stringify({ type: "message", id: "test-user", parentId: null,
    message: { role: "user", content: [{ type: "text", text: "fixture isolation" }] } });
  const fixtureHome = await createAgentHomeFixture([entry]);
  assert.notEqual(fixtureHome, runnerHome);
  const files = readdirSync(join(fixtureHome, "sessions", "fixture"));
  assert.equal(files.length, 1);
  const rows = readFileSync(join(fixtureHome, "sessions", "fixture", files[0]), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(rows[0].cwd, join(fixtureHome, "workspace"));
  assert.deepEqual(rows[1], JSON.parse(entry));
  assert.equal(existsSync(join(runnerHome, "sessions")), false);
  assert.equal(existsSync(join(source, "sessions")), false);
  const directory = process.env.PI_E2E_TEST_DIR;
  cleanup();
  assert.equal(existsSync(directory), false);
});
