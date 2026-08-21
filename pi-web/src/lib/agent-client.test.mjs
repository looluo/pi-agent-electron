import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});
const { AgentCommandError, isPromptRejectedError, sendAgentCommand } = await jiti.import("./agent-client.ts");

// IPC transport: window.pi.agentCommand replaces fetch; main resolves
// { ok: false, error, code?, accepted? } with the same prompt-rejection
// semantics the HTTP route had.
function installBridge(impl) {
  globalThis.window = { pi: { agentCommand: impl } };
}
test.after(() => {
  delete globalThis.window;
});

test("agent command IPC rejections are distinguishable from transport failures", async () => {
  installBridge(async () => ({
    ok: false,
    error: "Authentication failed",
    code: "prompt_rejected",
    accepted: false,
  }));

  await assert.rejects(
    sendAgentCommand("session-id", { type: "prompt", message: "hello" }),
    (error) => {
      assert.equal(error instanceof AgentCommandError, true);
      assert.equal(error.message, "Authentication failed");
      assert.equal(error.code, "prompt_rejected");
      assert.equal(error.accepted, false);
      assert.equal(isPromptRejectedError(error), true);
      return true;
    },
  );

  const transportError = new TypeError("connection reset");
  installBridge(async () => {
    throw transportError;
  });

  await assert.rejects(
    sendAgentCommand("session-id", { type: "prompt", message: "hello" }),
    (error) => {
      assert.equal(error, transportError);
      assert.equal(error instanceof AgentCommandError, false);
      assert.equal(isPromptRejectedError(error), false);
      return true;
    },
  );
});

test("successful agent commands unwrap the data payload", async () => {
  installBridge(async () => ({ ok: true, data: { isStreaming: false } }));
  const data = await sendAgentCommand("session-id", { type: "get_state" });
  assert.deepEqual(data, { isStreaming: false });
});
