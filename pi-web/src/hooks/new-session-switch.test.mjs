import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";

// A fresh composer's first send, with the user switching to another session at
// each step of its startup (upstream #1146). Switching unmounts the composer,
// which closes its event stream; the prompt must still reach the new session.
// Re-homed from upstream's fetch/SSE stubs onto the typed Electron bridge
// (window.pi), the transport this app owns.
const shimPath = fileURLToPath(new URL("./__fixtures__/react-hook-shim.mjs", import.meta.url));
const jiti = createJiti(import.meta.url, { tsconfigPaths: true, alias: { react: shimPath } });
const { renderHook } = await import(pathToFileURL(shimPath).href);
const { useAgentSession } = await jiti.import("./useAgentSession.ts");

globalThis.document ??= Object.assign(new EventTarget(), { visibilityState: "visible" });
globalThis.window ??= new EventTarget();

const settle = async () => { for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve)); };

async function sendAndSwitch(stage) {
  const creation = Promise.withResolvers();
  const acceptance = Promise.withResolvers();
  const commands = [];
  const subscribers = [];
  const created = [];

  const frame = (kind, data) => ({ kind, ...(data !== undefined ? { data } : {}) });

  globalThis.window.pi = {
    agentNew: async () => creation.promise,
    agentCommand: async (sessionId, command) => {
      commands.push(command);
      if (command.type === "prompt") return acceptance.promise;
      return { ok: true, data: null };
    },
    agentState: async () => ({ running: true, state: { isStreaming: true, isPromptRunning: true } }),
    agentLease: async () => ({}),
    agentRunning: async () => ({ runningSessionIds: [] }),
    models: async () => ({ status: 200, body: { models: {}, modelList: [] } }),
    subscribeAgentEvents: (sessionId, onFrame) => {
      const source = {
        sessionId,
        onFrame,
        connect() { onFrame(frame("open")); onFrame(frame("event", JSON.stringify({ type: "connected", isStreaming: false }))); },
        close() { onFrame(frame("closed")); },
      };
      subscribers.push(source);
      return () => { source.closed = true; };
    },
  };

  const hook = renderHook(useAgentSession, {
    session: null,
    newSessionCwd: "/project",
    newSessionDraftKey: "new:draft",
    onSessionCreated: (session) => created.push(session.id),
  });
  await settle();
  hook.flush();
  const originalError = console.error;
  console.error = () => {};
  try {
    const sending = hook.result.handleSend("first message");
    await settle();
    if (stage === "creating") hook.unmount();
    creation.resolve({ ok: true, data: { sessionId: "s1" } });
    await settle();
    if (stage === "connecting") hook.unmount();
    else subscribers.at(-1)?.connect();
    await settle();
    if (stage === "prompting") hook.unmount();
    acceptance.resolve({ ok: true, data: null });
    await sending;
    await settle();
  } finally {
    console.error = originalError;
    for (const source of subscribers) source.close();
  }
  if (stage === "mounted") hook.unmount();
  return { commands, created, opened: subscribers.length };
}

for (const stage of ["mounted", "creating", "connecting", "prompting"]) {
  test(`a first prompt reaches its new session when the user switches away (${stage})`, async () => {
    const result = await sendAndSwitch(stage);
    assert.deepEqual(result.commands.map((command) => command.type), ["prompt"]);
    assert.deepEqual(result.created, ["s1"]);
  });
}

test("a composer unmounted before its session exists opens no event stream for it", async () => {
  assert.equal((await sendAndSwitch("creating")).opened, 0);
  assert.equal((await sendAndSwitch("mounted")).opened, 1);
});
