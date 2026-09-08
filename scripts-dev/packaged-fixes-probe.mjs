// Packaged-app verification of the three renderer transport fixes
// (thinking / bash-output / markdown image) against release/mac-arm64.
// Mirrors tests/e2e/{thinking,bash-output,markdown-image}.spec.ts via CDP.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

const ROOT = resolve(import.meta.dirname, "..");
const EXE = join(ROOT, "release/mac-arm64/Pi Agent App.app/Contents/MacOS/Pi Agent App");
const PORT = Number(process.env.PROBE_PORT ?? 9347);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const bashLog = join(tmpdir(), "pi-bash-pkg77ce.log");
writeFileSync(bashLog, "head line\nBASH-PKG-MARKER tail of full log\n");

const agentHome = join(ROOT, "tests", ".e2e-agent-home");
rmSync(agentHome, { recursive: true, force: true });
const workspace = join(agentHome, "workspace");
mkdirSync(join(agentHome, "sessions", `-${workspace.split("/").join("-")}-`), { recursive: true });
mkdirSync(workspace, { recursive: true });
writeFileSync(join(workspace, "screenshot.png"), PNG);

const id = "01e2e000-0000-7000-8000-00000000f1a7";
const mk = (o) => JSON.stringify(o);
const lines = [
  mk({ type: "session", version: 3, id, timestamp: "2026-09-08T00:00:00.000Z", cwd: workspace }),
  mk({ type: "message", id: "u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z", message: { role: "user", content: [{ type: "text", text: "pkg fixture e2e" }] } }),
  mk({ type: "message", id: "a1", parentId: "u1", timestamp: "2026-09-08T00:00:02.000Z", message: { role: "assistant", content: [
    { type: "thinking", thinking: "preview line\nTHINKING-PKG-MARKER full body beyond the preview" },
    { type: "text", text: "shot:\n\n![pkg shot](screenshot.png)" },
  ], model: "fixture", provider: "fixture", usage: { input: 1, output: 1 } } }),
  mk({ type: "message", id: "b1", parentId: "a1", timestamp: "2026-09-08T00:00:03.000Z", message: { role: "bashExecution", command: "echo pkg", output: "head line …", exitCode: 0, truncated: true, fullOutputPath: bashLog } }),
];
writeFileSync(join(agentHome, "sessions", `-${workspace.split("/").join("-")}-`, `2026-09-08T00-00-00-000Z_${id}.jsonl`), lines.join("\n") + "\n");

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === "page");
      if (page) return page;
    } catch { /* retry */ }
    await delay(500);
  }
  throw new Error("CDP page target never appeared");
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
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, call })));
}

const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], {
  stdio: "ignore",
  env: { ...process.env, PI_CODING_AGENT_DIR: agentHome },
});
try {
  const page = await waitForCdp();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = (expression) => call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  // open the fixture session by clicking its sidebar row
  await evalJs(`(async () => {
    for (let i = 0; i < 80; i++) {
      const el = [...document.querySelectorAll("*")].find((n) => n.childElementCount === 0 && n.textContent === "pkg fixture e2e");
      if (el) { el.click(); return true; }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  })()`);

  // 1. thinking: expand 处理详情 group, then the thinking block
  const think = await evalJs(`(async () => {
    const findBtn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.getAttribute("aria-label") || b.textContent || ""));
    for (let i = 0; i < 40; i++) { const b = findBtn(/处理详情|Process details/); if (b) { b.click(); break; } await new Promise((r) => setTimeout(r, 250)); }
    for (let i = 0; i < 40; i++) { const b = findBtn(/^(思考|Thinking)/); if (b) { b.click(); break; } await new Promise((r) => setTimeout(r, 250)); }
    for (let i = 0; i < 40; i++) {
      if (document.body.textContent.includes("THINKING-PKG-MARKER")) return { ok: true };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { ok: false, failedFetch: document.body.textContent.includes("Failed to fetch") };
  })()`);
  check("thinking expand (packaged)", think.result.value.ok === true, think.result.value.ok ? "" : JSON.stringify(think.result.value));

  // 2. bash full output: view full output, then expand the bash block
  const bash = await evalJs(`(async () => {
    for (let i = 0; i < 40; i++) { const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "view full output"); if (b) { b.click(); break; } await new Promise((r) => setTimeout(r, 250)); }
    for (let i = 0; i < 40; i++) { const b = [...document.querySelectorAll("button")].find((x) => /bash echo pkg/.test(x.textContent || "")); if (b) { b.click(); break; } await new Promise((r) => setTimeout(r, 250)); }
    for (let i = 0; i < 40; i++) {
      if (document.body.textContent.includes("BASH-PKG-MARKER")) return { ok: true };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { ok: false, forbidden: document.body.textContent.includes("forbidden"), failedFetch: document.body.textContent.includes("Failed to fetch") };
  })()`);
  check("bash full output (packaged)", bash.result.value.ok === true, bash.result.value.ok ? "" : JSON.stringify(bash.result.value));

  // 3. markdown local image loads via pifile://
  const img = await evalJs(`(async () => {
    for (let i = 0; i < 40; i++) {
      const el = document.querySelector('img[alt="pkg shot"]');
      if (el) return { src: el.src, w: el.naturalWidth };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { src: null, w: 0 };
  })()`);
  check("markdown local image (packaged)", img.result.value.w > 0 && img.result.value.src.startsWith("pifile://"), `${img.result.value.src} ${img.result.value.w}px`);

  ws.close();
} finally {
  child.kill("SIGKILL");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
