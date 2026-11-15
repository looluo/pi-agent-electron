import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream app/api/models-config/test/route.test.mjs (this sync's
// "Test model prepares its probe like a chat request" wave). Ours re-homes the
// route onto the electron models-auth service, so the fixture drives
// modelsTest() with plain arguments and a mocked fetch.
const base = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-models-config-test-route-"));
process.env.PI_CODING_AGENT_DIR = path.join(base, "agent");
fs.mkdirSync(process.env.PI_CODING_AGENT_DIR);
test.after(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  fs.rmSync(base, { recursive: true, force: true });
});

const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  interopDefault: true,
  moduleCache: false,
});
const { modelsTest } = await jiti.import("../../../electron/main/services/models-auth.ts");

function completionStream() {
  const chunk = {
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 0,
    model: "deepseek-v4.1-flash",
    choices: [{ index: 0, delta: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("Test model prepares the probe like a chat request: auth and models.json headers, an OpenCode session id", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const request = new Request(input, init);
    requests.push({ url: request.url, headers: request.headers });
    return completionStream();
  });

  const result = await modelsTest({
    providerName: "open-code-go",
    provider: {
      baseUrl: "https://opencode.ai/zen/go/v1",
      api: "openai-completions",
      apiKey: "oc_sk_test",
      headers: { "X-Custom": "from-models-json" },
    },
    model: { id: "deepseek-v4.1-flash", api: "openai-completions", input: ["text"] },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true, result.body.error);
  assert.equal(result.body.responseText, "OK");
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, "https://opencode.ai/zen/go/v1/chat/completions");
  assert.equal(request.headers.get("authorization"), "Bearer oc_sk_test");
  assert.equal(request.headers.get("x-custom"), "from-models-json");
  assert.match(request.headers.get("x-opencode-session") ?? "", /^[0-9a-f-]{36}$/);
});

test("Test model runs a `!command` key once", { skip: process.platform === "win32" }, async (t) => {
  const counter = path.join(base, "key-command-runs");
  t.mock.method(globalThis, "fetch", async () => completionStream());
  const result = await modelsTest({
    providerName: "command-key",
    provider: {
      baseUrl: "https://example.test/v1",
      api: "openai-completions",
      apiKey: `!printf x >> '${counter}'; printf key`,
    },
    model: { id: "m", api: "openai-completions", input: ["text"] },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true, result.body.error);
  assert.equal(await fs.promises.readFile(counter, "utf8"), "x");
});
