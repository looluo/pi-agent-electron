import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { createSideChat } = await createJiti(import.meta.url).import("./side-chat-client.ts");

// Fork: the POST /api/sessions/[id]/fork route is the `pi:sessions:fork` IPC
// (window.pi.sessionsFork), so the transport mock replaces global fetch.
function answer(t, status, body) {
  const calls = [];
  const previous = globalThis.window;
  globalThis.window = {
    pi: {
      sessionsFork: async (id, options) => {
        calls.push({ id, options });
        return { status, body: typeof body === "string" ? body : { ...body } };
      },
    },
  };
  t.after(() => { globalThis.window = previous; });
  return calls;
}
const translate = (key) => `t:${key}`;

test("a side chat is asked of the fork route, with a name only when there is one", async (t) => {
  const session = { id: "side" };
  const calls = answer(t, 200, { sessionId: "side", session });
  assert.deepEqual(await createSideChat("a/b", translate), { session });
  assert.deepEqual(await createSideChat("a", translate, "selected"), { session });
  assert.equal(calls[0].id, "a/b");
  assert.deepEqual(calls[0].options, { side: true });
  assert.deepEqual(calls[1].options, { side: true, name: "selected" });
});

test("a refusal reads as its translated notice, anything else as what the server said", async (t) => {
  answer(t, 409, { code: "empty", error: "raw" });
  assert.deepEqual(await createSideChat("a", translate), { error: "t:sideChat.error.empty" });
  answer(t, 500, { code: "failed", error: "raw" });
  assert.deepEqual(await createSideChat("a", translate), { error: "raw" });
  answer(t, 502, "not json");
  assert.deepEqual(await createSideChat("a", translate), { error: "HTTP 502" });
});
