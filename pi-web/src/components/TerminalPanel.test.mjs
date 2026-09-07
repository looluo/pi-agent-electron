import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createRequire } from "node:module";

// Electron adaptation: upstream TerminalPanel.test.mjs exercises the HTTP
// terminalRequest writer (ordering, batching, no-retry). The IPC client keeps
// only the invariants that still exist: ordered delivery per invoke, and
// input never replayed after a failure.
const require = createRequire(import.meta.url);
const { createTerminalWriter, createWorkspaceTerminal } = await import("../lib/terminal-client.ts").catch(async () => {
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  return jiti.import("../lib/terminal-client.ts");
});

function installBridge(impl) {
  const previous = globalThis.window;
  globalThis.window = { pi: impl };
  return () => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  };
}

test("create surfaces server diagnostics from the create channel", async () => {
  const restore = installBridge({
    terminalCreate: async () => ({ status: 500, body: { error: "native terminal module failed to load; run npm rebuild node-pty" } }),
  });
  try {
    await assert.rejects(createWorkspaceTerminal("/w", 80, 24, "id"), /npm rebuild node-pty/);
  } finally {
    restore();
  }
});

test("writer calls reach the bridge in order", async () => {
  const calls = [];
  const restore = installBridge({
    terminalWrite: async (id, data) => { calls.push(["write", id, data]); return true; },
    terminalResize: async (id, cols, rows) => { calls.push(["resize", id, cols, rows]); return true; },
  });
  try {
    const writer = createTerminalWriter("id", assert.fail);
    writer.write("a");
    writer.resize(100, 30);
    writer.write("b\r");
    await setImmediate();
    assert.deepEqual(calls, [
      ["write", "id", "a"],
      ["resize", "id", 100, 30],
      ["write", "id", "b\r"],
    ]);
    writer.stop();
  } finally {
    restore();
  }
});

test("failed delivery discards later input without retrying commands", async () => {
  const calls = [];
  const restore = installBridge({
    terminalWrite: async (_id, data) => {
      calls.push(data);
      return data !== "first";
    },
    terminalResize: async () => true,
  });
  const errors = [];
  try {
    const writer = createTerminalWriter("id", (error) => errors.push(error.message));
    writer.write("first");
    writer.write("second");
    await setImmediate();
    assert.deepEqual(calls, ["first", "second"]);
    // IPC invokes already delivered; the writer must stop after the failure.
    writer.write("third");
    await setImmediate();
    assert.deepEqual(calls, ["first", "second"]);
    assert.deepEqual(errors, ["terminal write failed"]);
  } finally {
    restore();
  }
});
