import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Ported from upstream lib/llama-cpp.integration.test.mjs (this sync's
// built-in llama.cpp provider wave). Ours re-homes the four routes onto the
// electron models-auth service + lib/default-preferences, so the fixture
// drives those directly; the router itself stays a mocked fetch.
const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  interopDefault: true,
  moduleCache: false,
});

test("Settings lists llama.cpp, connects a router and makes its model available to a fresh session", async (t) => {
  const agentDir = await mkdtemp(join(tmpdir(), "pi-web-llama-"));
  t.after(() => rm(agentDir, { recursive: true, force: true }));
  process.env.PI_CODING_AGENT_DIR = agentDir;
  delete process.env.LLAMA_BASE_URL;
  delete process.env.LLAMA_API_KEY;
  delete process.env.PI_OFFLINE;
  const router = "http://router.invalid:8080";
  let expectedKey = "";
  let models = [{ id: "local-chat", status: { value: "loaded" }, meta: { n_ctx: 8192 } }];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, router);
    if (expectedKey) assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${expectedKey}`);
    if (url.pathname === "/models") return Response.json({ data: models });
    assert.equal(url.pathname, "/props");
    return Response.json({});
  });

  const { SettingsManager } = await jiti.import("@earendil-works/pi-coding-agent");
  const { authProviders, apiKeySet, modelsGet } = await jiti.import("../../../electron/main/services/models-auth.ts");
  const { startRpcSession } = await jiti.import("./rpc-manager.ts");
  const { allowFileRoot } = await jiti.import("./file-access.ts");
  const { invalidateModelRuntimeWithExtensions } = await jiti.import("./model-runtime.ts");
  const { writeDefaultPreferences } = await jiti.import("./default-preferences.ts");
  const row = async () => (await authProviders()).apiKeyProviders.find((p) => p.id === "llama.cpp");
  allowFileRoot(agentDir);
  async function pickedModels() {
    const { status, body } = await modelsGet(agentDir);
    assert.equal(status, 200, JSON.stringify(body));
    return body.modelList.filter((model) => model.provider === "llama.cpp").map((model) => model.id);
  }
  const save = (apiKey, serverUrl) => apiKeySet("llama.cpp", apiKey, serverUrl);

  assert.equal((await row()).configured, false);
  assert.equal((await save("", "invalid")).status, 400);
  for (const apiKey of ["", "test-llama-key"]) {
    expectedKey = apiKey;
    const result = await save(apiKey, router + "/v1");
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.catalog.completed, true, JSON.stringify(result.body));
    assert.equal((await row()).configured, true);
    const stored = JSON.parse(await readFile(join(agentDir, "auth.json"), "utf8"))["llama.cpp"];
    assert.equal(stored.env.LLAMA_BASE_URL, router);
    assert.equal(stored.key, apiKey || undefined);
    assert.deepEqual(await pickedModels(), ["local-chat"]);
    await writeDefaultPreferences(SettingsManager.create(agentDir, agentDir), { model: { provider: "llama.cpp", modelId: "local-chat" } });
    const { session } = await startRpcSession(`__new__${randomUUID()}`, "", agentDir);
    try {
      const { model, modelRuntime } = session.inner;
      assert.equal(model.provider, "llama.cpp");
      assert.equal(model.id, "local-chat");
      assert.equal(model.contextWindow, 8192);
      const request = await modelRuntime.prepareRequest(model);
      assert.equal(request.model.baseUrl, router + "/v1");
      assert.equal(request.options.apiKey, apiKey || "local");
    } finally {
      await session.shutdown();
    }
    invalidateModelRuntimeWithExtensions();
  }
  // An empty catalog must also reach the picker after the previous one was remembered.
  models = [];
  const { refreshModelCatalogs } = await jiti.import("./model-catalog-refresh.ts");
  await refreshModelCatalogs({ providers: ["llama.cpp"] });
  assert.deepEqual(await pickedModels(), []);
  const { apiKeyDelete } = await jiti.import("../../../electron/main/services/models-auth.ts");
  assert.equal((await apiKeyDelete("llama.cpp")).status, 200);
  assert.equal((await row()).configured, false);

  const { writeFile } = await jiti.import("node:fs/promises");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ extensions: ["-builtin:llama.cpp"] }));
  invalidateModelRuntimeWithExtensions();
  assert.equal(await row(), undefined);
});
