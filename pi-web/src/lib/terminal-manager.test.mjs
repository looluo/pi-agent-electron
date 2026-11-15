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
// The vm harnesses below require() terminal-manager's imports; the SDK is ESM-only, so they get this stub.
const piSdkStub = { getPowerShellConfig() { throw new Error("No PowerShell executable found."); } };

test("native module load failures are deferred until creation and include repair instructions", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, process, require(id) {
    if (id === "node-pty") throw new Error("Cannot find module pty.node");
    if (id === "@earendil-works/pi-coding-agent") return piSdkStub;
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
    if (id === "@earendil-works/pi-coding-agent") return piSdkStub;
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
    if (id === "@earendil-works/pi-coding-agent") return piSdkStub;
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

test("Windows terminals close without a signal or a SIGKILL fallback (#1560)", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const killCalls = [];
  // node-pty's WindowsTerminal throws "Signals not supported on windows." for any signal.
  const makePty = () => ({ onData() {}, onExit() {}, write() {}, resize() {}, kill(...args) { if (args[0]) throw new Error("Signals not supported on windows."); killCalls.push(args); } });
  const fakeRequire = (id) => {
    if (id === "node-pty") return { spawn: () => makePty() };
    if (id === "@earendil-works/pi-coding-agent") return piSdkStub;
    if (id === "./paths") return paths;
    return require(id);
  };
  const timers = [];
  const fakeSetTimeout = (fn, ms) => { const timer = { fn, ms, unref() {} }; timers.push(timer); return timer; };
  const exports = {};
  runInNewContext(outputText, { exports, process: { ...process, env: { ComSpec: "cmd.exe" }, once() {}, platform: "win32" }, require: fakeRequire, setTimeout: fakeSetTimeout, clearTimeout() {}, console });
  const forced = exports.createTerminal(process.cwd(), 80, 24);
  const plain = exports.createTerminal(process.cwd(), 80, 24);
  timers.length = 0;
  assert.equal(exports.killTerminal(forced, true), true);
  assert.equal(exports.killTerminal(plain), true);
  assert.deepEqual(killCalls, [[], []]);
  assert.equal(timers.length, 0);
});

test("shell environment omits the web login password", async () => {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const spawnCalls = [];
  const fakePty = { onData() {}, onExit() {}, write() {}, resize() {}, kill() {} };
  const fakeRequire = (id) => {
    if (id === "node-pty") return { spawn: (...args) => { spawnCalls.push(args); return fakePty; } };
    if (id === "@earendil-works/pi-coding-agent") return piSdkStub;
    if (id === "./paths") return paths;
    return require(id);
  };
  const env = { ...process.env, PI_WEB_PASSWORD: "web-login-password", PI_USER_SETTING: "preserved" };
  const exports = {};
  runInNewContext(outputText, { exports, process: { ...process, env, once() {}, platform: process.platform }, require: fakeRequire, setTimeout, clearTimeout, console });
  exports.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal("PI_WEB_PASSWORD" in spawnCalls[0][2].env, false);
  assert.equal(spawnCalls[0][2].env.PI_USER_SETTING, "preserved");
});

/** The file and args createTerminal() spawns, on a given platform, with pi's PowerShell resolution faked. */
async function spawnedShell({ platform, env, powerShell }) {
  const require = createRequire(import.meta.url);
  const paths = await jiti.import("./paths.ts");
  const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const spawnCalls = [];
  let powerShellLookups = 0;
  const fakePty = { onData() {}, onExit() {}, write() {}, resize() {}, kill() {} };
  const fakeRequire = (id) => {
    if (id === "node-pty") return { spawn: (...args) => { spawnCalls.push(args); return fakePty; } };
    if (id === "@earendil-works/pi-coding-agent") {
      return { getPowerShellConfig: () => {
        powerShellLookups++;
        if (!powerShell) throw new Error("No PowerShell executable found.");
        return { shell: powerShell, args: ["-NoProfile", "-Command"] };
      } };
    }
    if (id === "./paths") return paths;
    return require(id);
  };
  const exports = {};
  runInNewContext(outputText, { exports, process: { ...process, env, once() {}, platform }, require: fakeRequire, setTimeout, clearTimeout, console });
  exports.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  // Copied out of the sandbox's realm, so deepEqual compares plain arrays.
  return { file: spawnCalls[0][0], args: [...spawnCalls[0][1]], powerShellLookups };
}

test("a Windows terminal starts PowerShell as pi resolves it, then ComSpec, then cmd.exe", async () => {
  const comSpec = "C:\\Windows\\system32\\cmd.exe";
  // pi's getPowerShellConfig() prefers PowerShell 7 and returns where's WindowsApps alias as is.
  const pwsh = "C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
  assert.deepEqual(
    await spawnedShell({ platform: "win32", env: { ComSpec: comSpec }, powerShell: pwsh }),
    { file: pwsh, args: [], powerShellLookups: 1 },
    "interactive: none of the powershell tool's -Command arguments",
  );
  assert.deepEqual(
    await spawnedShell({ platform: "win32", env: { ComSpec: comSpec }, powerShell: null }),
    { file: comSpec, args: [], powerShellLookups: 1 },
  );
  assert.deepEqual(
    await spawnedShell({ platform: "win32", env: {}, powerShell: null }),
    { file: "cmd.exe", args: [], powerShellLookups: 1 },
  );
});

test("a non-Windows terminal starts $SHELL as a login shell and never looks for PowerShell", async () => {
  assert.deepEqual(
    await spawnedShell({ platform: "linux", env: { SHELL: "/usr/bin/zsh" }, powerShell: "pwsh" }),
    { file: "/usr/bin/zsh", args: ["-l"], powerShellLookups: 0 },
  );
  assert.deepEqual(
    await spawnedShell({ platform: "darwin", env: {}, powerShell: "pwsh" }),
    { file: "/bin/sh", args: ["-l"], powerShellLookups: 0 },
  );
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

