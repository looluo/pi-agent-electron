// Slice-2 end-to-end probe: files protocol, watch, workspace facades.
import WebSocket from "ws";

const DEBUG_PORT = Number(process.env.PROBE_PORT ?? 9333);
const base = `http://127.0.0.1:${DEBUG_PORT}`;

async function findPage() {
  const res = await fetch(`${base}/json/list`);
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
  const cwd = process.env.PROBE_CWD.replace(/\\/g, "/");
  const repo = process.env.PROBE_REPO.replace(/\\/g, "/");
  const probeFile = `${cwd}/probe.txt`;

  const page = await findPage();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("page eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };

  // In-page helpers: paths arrive with forward slashes; encode each segment.
  await evalJs(`window.__probe = {
    cwd: ${JSON.stringify(cwd)},
    repo: ${JSON.stringify(repo)},
    file: ${JSON.stringify(probeFile)},
    pifile(p, type) {
      const segs = p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      return 'pifile://local/' + segs + '?type=' + type;
    },
  };`);

  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + String(detail).slice(0, 160) : ""}`);
  };

  // files list via protocol fetch
  const list = await evalJs(`fetch(window.__probe.pifile(window.__probe.cwd, 'list')).then(r => r.json())`);
  step("files list (pifile)", Array.isArray(list?.entries), JSON.stringify(list).slice(0, 100));

  // upload probe file
  const up = await evalJs(`window.pi.filesUpload(window.__probe.cwd, [{ name: 'probe.txt', bytes: new TextEncoder().encode('hello-slice2') }], null)`);
  step("files upload", up?.status === 200 && Array.isArray(up.body?.uploaded) && up.body.uploaded.includes("probe.txt"), JSON.stringify(up?.body ?? up).slice(0, 120));

  // read text back
  const readBack = await evalJs(`fetch(window.__probe.pifile(window.__probe.file, 'read')).then(r => r.json())`);
  step("files read (pifile)", readBack?.content === "hello-slice2", JSON.stringify(readBack).slice(0, 80));

  // meta
  const meta = await evalJs(`fetch(window.__probe.pifile(window.__probe.file, 'meta')).then(r => r.json())`);
  step("files meta (pifile)", typeof meta?.size === "number" && meta.size === 12, JSON.stringify(meta).slice(0, 80));

  // upload-check conflict detection
  const check = await evalJs(`window.pi.filesUploadCheck(window.__probe.cwd, ['probe.txt'])`);
  step("upload-check conflict", Array.isArray(check?.body?.conflicts) && check.body.conflicts.includes("probe.txt"), JSON.stringify(check?.body).slice(0, 100));

  // watch connected frame
  const watch = await evalJs(`(async () => {
    const frames = [];
    const done = new Promise((resolve) => {
      const unsub = window.pi.subscribeFileWatch(window.__probe.file, (f) => {
        frames.push(f.event);
        if (f.event === 'connected') { setTimeout(() => { unsub(); resolve({ connected: true, frames }); }, 300); }
      });
      setTimeout(() => resolve({ connected: frames.includes('connected'), frames }), 5000);
    });
    return done;
  })()`);
  step("file watch connected", watch?.connected === true, JSON.stringify(watch));

  // watch change event: re-upload (replace) bumps mtime
  const watchChange = await evalJs(`(async () => {
    const seen = [];
    const done = new Promise((resolve) => {
      const unsub = window.pi.subscribeFileWatch(window.__probe.file, (f) => {
        if (f.event === 'connected') {
          window.pi.filesUpload(window.__probe.cwd, [{ name: 'probe.txt', bytes: new TextEncoder().encode('changed!') }], 'overwrite')
            .catch(() => {});
        }
        if (f.event === 'change') { seen.push('change'); unsub(); resolve({ changed: true }); }
      });
      setTimeout(() => { unsub(); resolve({ changed: false }); }, 8000);
    });
    return done;
  })()`);
  step("file watch change", watchChange?.changed === true);

  // file-index
  const idx = await evalJs(`window.pi.fileIndex(window.__probe.cwd)`);
  step("file-index", idx?.status === 200 && Array.isArray(idx.body?.files) && idx.body.files.includes("probe.txt"), JSON.stringify(idx?.body?.files?.slice(0, 5)));

  // git status on the migration repo
  const git = await evalJs(`window.pi.gitStatus(window.__probe.repo)`);
  step("git status", git?.status === 200 && typeof git.body?.isGitRepository === "boolean", JSON.stringify(git?.body).slice(0, 80));

  // git diff on a modified file (package.json vs upstream? probe repo has modifications)
  const diff = await evalJs(`window.pi.gitDiff(window.__probe.repo, window.__probe.repo + '/package.json')`);
  step("git diff", diff?.status === 200 && typeof diff.body?.supported === "boolean", JSON.stringify(diff?.body).slice(0, 80));

  // worktrees get
  const wt = await evalJs(`window.pi.worktreesGet(window.__probe.repo)`);
  step("worktrees get", wt?.status === 200 && typeof wt.body?.isGit === "boolean", `worktrees=${wt?.body?.worktrees?.length}`);

  // cwd validate
  const cv = await evalJs(`window.pi.cwdValidate(window.__probe.cwd)`);
  step("cwd validate", cv?.status === 200 && typeof cv.body?.cwd === "string", JSON.stringify(cv?.body).slice(0, 90));

  // home + default-cwd + browse + trust
  const home = await evalJs("window.pi.home()");
  step("home", typeof home?.home === "string", String(home?.home).slice(0, 60));

  const dc = await evalJs("window.pi.defaultCwd()");
  step("default-cwd", typeof dc?.cwd === "string" && dc.cwd.includes("pi-cwd-"), String(dc?.cwd).slice(0, 60));

  const browse = await evalJs(`window.pi.cwdBrowse(window.__probe.cwd)`);
  step("cwd browse", Array.isArray(browse?.directories), `dirs=${browse?.directories?.length}`);

  const pt = await evalJs(`window.pi.projectTrustGet(window.__probe.cwd)`);
  step("project-trust get", pt?.status === 200 || pt?.status === 403, JSON.stringify(pt?.status));

  // cleanup probe file
  await evalJs(`window.pi.filesUpload(window.__probe.cwd, [], null).then(() => null)`);

  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "ALL GREEN" : `FAILURES: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("probe error:", e.message); process.exit(2); });
