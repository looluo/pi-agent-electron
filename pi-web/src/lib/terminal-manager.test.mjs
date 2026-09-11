import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } });
const { createTerminal, getTerminalCwd, hasTerminal, killTerminal, subscribeTerminal, TERMINAL_RECONNECT_MS } = await jiti.import("./terminal-manager.ts");

test("native module load failures are deferred until creation and include repair instructions", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, process, require(id) {
    if (id === "node-pty") throw new Error("Cannot find module pty.node");
    return id === "./paths" ? paths : require(id);
  } });
  assert.equal(exports.hasTerminal("missing"), false);
  assert.throws(() => exports.createTerminal(process.cwd(), 80, 24), (error) => {
    assert.match(error.message, /native terminal module/);
    assert.match(error.message, /npm rebuild node-pty --build-from-source --ignore-scripts=false --foreground-scripts/);
    assert.match(error.message, /Cannot find module pty.node/);
    return true;
  });
});

test("shell environment defaults to UTF-8 locale when the host has none", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const spawnCalls = [];
  const fakePty = { onData() {}, onExit() {}, write() {}, resize() {}, kill() {} };
  const fakeRequire = (id) => {
    if (id === "node-pty") return { spawn: (...args) => { spawnCalls.push(args); return fakePty; } };
    if (id === "./paths") return paths;
    return require(id);
  };
  const envWithoutLocale = Object.fromEntries(Object.entries(process.env).filter(([k]) => !["LANG", "LC_ALL", "LC_CTYPE"].includes(k)));
  const exports = {};
  runInNewContext(outputText, { exports, process: { ...process, env: envWithoutLocale, once() {}, platform: process.platform }, require: fakeRequire, setTimeout, clearTimeout, console });
  exports.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0][2].env.LANG, "C.UTF-8");
});

test("shell environment preserves a case-insensitive Windows locale", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const spawnCalls = [];
  const fakePty = { onData() {}, onExit() {}, write() {}, resize() {}, kill() {} };
  const fakeRequire = (id) => {
    if (id === "node-pty") return { spawn: (...args) => { spawnCalls.push(args); return fakePty; } };
    if (id === "./paths") return paths;
    return require(id);
  };
  const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["lang", "lc_all", "lc_ctype"].includes(key.toLowerCase())));
  rawEnv.lang = "zh_CN.UTF-8";
  const envWithLocale = new Proxy(rawEnv, {
    get(target, key) {
      if (typeof key !== "string") return Reflect.get(target, key);
      const match = Object.keys(target).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
      return match ? target[match] : undefined;
    },
  });
  const exports = {};
  runInNewContext(outputText, { exports, process: { ...process, env: envWithLocale, once() {}, platform: process.platform }, require: fakeRequire, setTimeout, clearTimeout, console });
  exports.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0][2].env.lang, "zh_CN.UTF-8");
  assert.equal("LANG" in spawnCalls[0][2].env, false);
});

test("native PTY starts after install and repeated creation reuses the same workspace process", (t) => {
  const id = createTerminal(process.cwd(), 80, 24);
  t.after(() => killTerminal(id));
  const record = globalThis.__piWebTerminals.get(id);
  // node-pty 1.2.0-beta reports pid 0 under Windows ConPTY; the lease still exists.
  assert.ok(process.platform === "win32" ? record.pty.pid >= 0 : record.pty.pid > 0);
  assert.equal(getTerminalCwd(id), process.cwd());
  assert.equal(createTerminal(process.cwd(), 100, 30, id), id);
  assert.strictEqual(globalThis.__piWebTerminals.get(id), record);
  assert.throws(() => createTerminal(process.cwd() + "/other", 80, 24, id), /different workspace/);
  assert.ok(record.cleanupTimer, "unclaimed creations have a lease");
});

test("connected terminals outlive the grace period; only the last disconnect starts expiry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = createTerminal(process.cwd(), 80, 24);
  t.after(() => killTerminal(id));
  const first = subscribeTerminal(id, () => {});
  const second = subscribeTerminal(id, () => {});
  first.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS * 2);
  assert.ok(hasTerminal(id));
  second.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS - 1);
  assert.ok(hasTerminal(id));
  const resumed = subscribeTerminal(id, () => {});
  t.mock.timers.tick(TERMINAL_RECONNECT_MS);
  assert.ok(hasTerminal(id));
  resumed.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS);
  assert.equal(hasTerminal(id), false);
});

// Windows: node:test mock timers destabilize the real ConPTY child (the
// upstream suite runs on Linux/mac CI only); verify expiry behavior there.
(process.platform === "win32" ? test.skip : test)("unclaimed creations expire without requiring a browser cleanup request", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = createTerminal(process.cwd(), 80, 24);
  t.after(() => killTerminal(id));
  t.mock.timers.tick(TERMINAL_RECONNECT_MS);
  assert.equal(hasTerminal(id), false);
});

