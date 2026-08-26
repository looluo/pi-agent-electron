// Packaged-exe smoke probe: launch release/win-unpacked exe over CDP and
// verify the bridge + the IPC surfaces added/changed by the v0.8.11 sync,
// plus asset loading under the file:// renderer (icons must use relative
// paths — absolute "/x.svg" resolves to the filesystem root there).
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

const EXE = "release/win-unpacked/Pi Agent App.exe";
const DEBUG_PORT = Number(process.env.PROBE_PORT ?? 9344);

let results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function waitForCdp() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page;
    } catch { /* not up yet */ }
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

const imgLoads = `(src) => new Promise((res) => {
  const i = new Image();
  const t = setTimeout(() => res(false), 4000);
  i.onload = () => { clearTimeout(t); res(i.naturalWidth > 0); };
  i.onerror = () => { clearTimeout(t); res(false); };
  i.src = src;
})`;

const child = spawn(EXE, [`--remote-debugging-port=${DEBUG_PORT}`], { stdio: "ignore", detached: false });
try {
  const page = await waitForCdp();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = (expression) => call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  // Wait for the app shell (sidebar footer shortcuts) to mount.
  await evalJs(`(async () => {
    for (let i = 0; i < 40; i += 1) {
      if (document.querySelector('button[aria-label]')) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    return false;
  })()`);

  // 1. bridge present
  const bridge = await evalJs("typeof window.pi");
  check("window.pi bridge", bridge.result.value === "object", String(bridge.result.value));

  // 2. sessions list (core transport)
  const sessions = await evalJs("window.pi.sessionsList(false).then((r) => ({ ok: Array.isArray(r.sessions), n: r.sessions?.length }))");
  check("sessionsList over IPC", sessions.result.value.ok === true, `${sessions.result.value.n} sessions`);

  // 3. subagents IPC surface (issue 01)
  const sub = await evalJs("window.pi.subagentsSettingsGet().then((r) => ({ status: r.status, enabled: r.body?.enabled }))");
  check("subagents settings channel", sub.result.value.status === 200 && sub.result.value.enabled === false, `status=${sub.result.value.status} enabled=${sub.result.value.enabled} (release gate: off)`);

  // 4. tools settings channel (issue 02; win32)
  const tools = await evalJs("window.pi.toolsSettingsGet().then((r) => ({ status: r.status, isWindows: r.body?.isWindows, ps: r.body?.powerShellEnabled }))");
  check("tools settings channel", tools.result.value.status === 200 && tools.result.value.isWindows === true, `powershell=${tools.result.value.ps}`);

  // 5. merged auth providers (issue 02 / 602b1b6)
  const auth = await evalJs("window.pi.authProviders().then((r) => ({ oauth: Array.isArray(r.oauthProviders), apiKey: Array.isArray(r.apiKeyProviders) }))");
  check("merged auth providers", auth.result.value.oauth === true && auth.result.value.apiKey === true);

  // 6. home facade
  const home = await evalJs("window.pi.home().then((r) => typeof r.home === 'string')");
  check("home facade", home.result.value === true);

  // 7. provider icon sprite loads under file:// (relative path)
  const sprite = await evalJs(`(${imgLoads})("provider-icons.svg")`);
  check("provider-icons.svg loads (relative)", sprite.result.value === true);

  // 8. catppuccin file icon var resolves + loads (relative path in inline style)
  const cat = await evalJs(`(async () => {
    const el = document.querySelector('.catppuccin-file-icon');
    if (!el) return { mounted: 0 };
    const raw = el.style.getPropertyValue('--catppuccin-icon-light').trim();
    const src = raw.slice(4, -1);
    const loads = await (${imgLoads})(src);
    return { mounted: document.querySelectorAll('.catppuccin-file-icon').length, src, loads };
  })()`);
  check("catppuccin file icons load", cat.result.value.mounted > 0 && cat.result.value.loads === true,
    `${cat.result.value.mounted} mounted, ${cat.result.value.src}`);

  // 9. UI-level: Models settings renders provider icons (locale-aware shortcut)
  const ui = await evalJs(`(async () => {
    const models = [...document.querySelectorAll('button[aria-label]')]
      .find((b) => /^(models|模型)$/i.test(b.getAttribute('aria-label')));
    if (!models) return { error: 'models button not found' };
    models.click();
    await new Promise((res) => setTimeout(res, 2000));
    const uses = [...document.querySelectorAll('svg use[href^="provider-icons.svg#"]')];
    const rendered = uses.filter((u) => {
      const box = u.closest('svg').getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { total: uses.length, rendered: rendered.length };
  })()`);
  check("Models panel renders provider icons", !ui.result.value.error && ui.result.value.rendered > 0,
    ui.result.value.error ?? `${ui.result.value.rendered}/${ui.result.value.total} rendered`);

  ws.close();
} finally {
  child.kill("SIGKILL");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
