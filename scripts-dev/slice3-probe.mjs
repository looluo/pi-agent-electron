// Slice-3 probe: models, models-config, auth facades, app-update.
import WebSocket from "ws";

const DEBUG_PORT = Number(process.env.PROBE_PORT ?? 9333);

async function findPage() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && t.type === "page");
  if (!page) throw new Error("renderer page not found");
  return page;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  let seq = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, call })));
}

async function main() {
  const repo = process.env.PROBE_REPO.replace(/\\/g, "/");
  const page = await findPage();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("page eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  await evalJs(`window.__probe = { repo: ${JSON.stringify(repo)} };`);

  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + String(detail).slice(0, 150) : ""}`);
  };

  // models list (real: zai-coding-cn configured on this machine)
  const models = await evalJs(`window.pi.models(window.__probe.repo)`);
  step("models", models?.status === 200 && Array.isArray(models.body?.modelList) && models.body.modelList.length > 0,
    `models=${models?.body?.modelList?.length} default=${JSON.stringify(models?.body?.defaultModel)}`);

  // models-config get
  const config = await evalJs("window.pi.modelsConfigGet()");
  step("models-config get", typeof config === "object" && config !== null, Object.keys(config ?? {}).slice(0, 5).join(","));

  // models-config put round-trip (write same content back)
  const put = await evalJs("window.pi.modelsConfigPut(window.pi.modelsConfigGet.__last ?? undefined)") ;
  void put;

  const putResult = await evalJs(`(async () => {
    const current = await window.pi.modelsConfigGet();
    return window.pi.modelsConfigPut(current);
  })()`);
  step("models-config put", putResult?.status === 200, JSON.stringify(putResult?.body));

  // auth providers lists
  const oauth = await evalJs("window.pi.authProviders()");
  step("auth providers (oauth)", Array.isArray(oauth?.providers), `n=${oauth?.providers?.length}`);
  const apiKeys = await evalJs("window.pi.authAllProviders()");
  step("auth all-providers (api key)", Array.isArray(apiKeys?.providers), `n=${apiKeys?.providers?.length}`);

  // api key status for the configured provider (never returns the key)
  const configured = apiKeys?.providers?.find((p) => p.configured) ?? oauth?.providers?.find((p) => p.loggedIn);
  if (configured) {
    const status = await evalJs(`window.pi.apiKeyStatus(${JSON.stringify(configured.id)})`);
    const hasRawKey = JSON.stringify(status).toLowerCase().includes("apikey\\\":\\\"");
    step("api-key status", status?.status === 200 && !hasRawKey, JSON.stringify(status?.body).slice(0, 80));
  } else {
    step("api-key status", true, "no configured provider on this machine (skipped)");
  }

  // app-update (GitHub Releases source). On this machine GitHub API is often
  // rate-limited (403) — a 502 {error} response proves the handler wired the
  // upstream failure through, which is the verifiable behavior here.
  const update = await evalJs("window.pi.appUpdate()");
  const updateOk = (update?.status === 200 && typeof update.body?.currentVersion === "string")
    || (update?.status === 502 && typeof update.body?.error === "string");
  step("app-update", updateOk, JSON.stringify(update?.body).slice(0, 120));

  // login push channel: unknown provider -> immediate error frame (full flow
  // needs a real browser OAuth dance — live-tested manually in the window)
  const login = await evalJs(`(async () => {
    const frames = [];
    const done = new Promise((resolve) => {
      const unsub = window.pi.subscribeAuthLogin('no-such-provider', (f) => {
        frames.push(f.data.type);
        if (f.data.type === 'error') { unsub(); resolve({ gotError: true, frames }); }
      });
      setTimeout(() => { unsub(); resolve({ gotError: false, frames }); }, 5000);
    });
    return done;
  })()`);
  step("auth login push (error frame)", login?.gotError === true, JSON.stringify(login));

  // models test — exercise a configured model if present (real LLM call)
  if (configured && models?.body?.modelList?.length) {
    const m = models.body.modelList[0];
    const test = await evalJs(`window.pi.modelsTest({
      providerName: ${JSON.stringify(m.provider)},
      provider: { baseUrl: "", api: "openai-completions" },
      model: { id: ${JSON.stringify(m.id)} },
    })`);
    step("models test (expected fail on bare provider)", test?.status === 200 && typeof test.body?.ok === "boolean",
      JSON.stringify(test.body).slice(0, 100));
  } else {
    step("models test", true, "skipped (no configured provider)");
  }

  // catalog (network: models.dev — blocked in this environment; a 502 error
  // body proves the fetch/cache/error path works end to end)
  const catalog = await evalJs(`window.pi.modelsCatalog('sonnet', '', 5)`);
  const catalogOk = (catalog?.status === 200 && Array.isArray(catalog.body?.models))
    || (catalog?.status === 502 && typeof catalog.body?.error === "string");
  step("models catalog", catalogOk, JSON.stringify(catalog?.body).slice(0, 100));

  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "ALL GREEN" : `FAILURES: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("probe error:", e.message); process.exit(2); });
