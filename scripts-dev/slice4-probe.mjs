// Slice-4 probe: skills, plugins, session export.
import WebSocket from "ws";

const DEBUG_PORT = 9333;

async function findPage() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("http://localhost"));
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
  // The files allow-list derives from session cwds; this worktree has none.
  // cwdValidate's side effect (allowFileRoot) authorizes it for this run.
  await evalJs('window.pi.cwdValidate(window.__probe.repo)');

  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + String(detail).slice(0, 150) : ""}`);
  };

  // skills list (repo has project + user skills via DefaultResourceLoader)
  const skills = await evalJs("window.pi.skillsList(window.__probe.repo)");
  const skillList = skills?.body?.skills ?? [];
  step("skills list", skills?.status === 200 && Array.isArray(skillList), `n=${skillList.length}`);

  // toggle a real skill's dormancy, then revert (surgical frontmatter edit)
  const target = skillList.find((sk) => !sk.disableModelInvocation) ?? skillList[0];
  if (target) {
    const toggleOn = await evalJs(`window.pi.skillsToggle(${JSON.stringify(target.filePath)}, true)`);
    const toggleOff = await evalJs(`window.pi.skillsToggle(${JSON.stringify(target.filePath)}, false)`);
    step("skills toggle round-trip", toggleOn?.status === 200 && toggleOff?.status === 200,
      `${target.name}: on=${toggleOn?.status} off=${toggleOff?.status}`);
  } else {
    step("skills toggle round-trip", true, "no skills installed (skipped)");
  }

  // skills check (network to github may fail here — error path ok)
  const check = await evalJs(`window.pi.skillsCheck({ cwd: window.__probe.repo })`);
  step("skills check", check?.status === 200 || check?.status === 500,
    JSON.stringify(check?.body).slice(0, 80));

  // skills search (skills.sh blocked here — fallback npx may also fail; both are wired)
  const search = await evalJs(`window.pi.skillsSearch('pdf')`);
  const searchOk = (search?.status === 200 && Array.isArray(search.body?.results))
    || (search?.status === 500 && typeof search.body?.error === "string");
  step("skills search (or wired error)", searchOk, JSON.stringify(search?.body).slice(0, 80));

  // plugins list
  const plugins = await evalJs("window.pi.pluginsList(window.__probe.repo)");
  step("plugins list", plugins?.status === 200 && Array.isArray(plugins.body?.packages),
    `n=${plugins?.body?.packages?.length} loaded=${plugins?.body?.totals?.extensions ?? 0}+${plugins?.body?.totals?.skills ?? 0}`);

  // export the probe session from slice 1 (a real session file from earlier runs;
  // fall back to the newest session in the probe cwd)
  const exportResult = await evalJs(`(async () => {
    const list = await window.pi.sessionsList();
    const sessions = list.sessions ?? [];
    const target = sessions.find((s) => (s.cwd ?? '').includes('pi-probe-cwd')) ?? sessions[0];
    if (!target) return { skipped: true };
    return window.pi.sessionExport(target.id);
  })()`);
  const exportOk = exportResult?.skipped === true
    || (exportResult?.status === 200 && typeof exportResult.body?.fileName === "string");
  step("session export (opens via shell)", exportOk, JSON.stringify(exportResult?.body).slice(0, 90));

  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "ALL GREEN" : `FAILURES: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("probe error:", e.message); process.exit(2); });
