// Slice-1 end-to-end probe: drives the real Electron renderer over CDP,
// exercising the IPC surface exactly as the UI would (window.pi).
import WebSocket from "ws";

const DEBUG_PORT = 9333;
const base = `http://127.0.0.1:${DEBUG_PORT}`;

async function findPage() {
  const res = await fetch(`${base}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("http://localhost"));
  if (!page) throw new Error("renderer page not found: " + JSON.stringify(targets.map((t) => t.url)));
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
  return new Promise((resolve) => {
    ws.on("open", () => resolve({ ws, call }));
  });
}

async function main() {
  const page = await findPage();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error("page eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };

  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + String(detail).slice(0, 200) : ""}`);
  };

  // 1. bridge present
  step("bridge", await evalJs("typeof window.pi === 'object' && typeof window.pi.agentCommand === 'function'"));

  // 2. sessions list
  const list = await evalJs("window.pi.sessionsList().then(r => ({ n: r.sessions?.length, err: r.error }))");
  step("sessionsList", typeof list?.n === "number" && !list?.err, JSON.stringify(list));

  // 3. new session (no LLM)
  const tmpCwd = await evalJs(
    "window.pi.agentNew({ cwd: D_SNAPSHOT, type: 'ensure_session', toolNames: [] })".replace(
      "D_SNAPSHOT",
      JSON.stringify(process.env.PROBE_CWD),
    ),
  );
  step("agentNew ensure_session", list_ok(list) || tmpCwd?.ok === true, JSON.stringify(tmpCwd).slice(0, 200));

  if (tmpCwd?.ok) {
    const sid = tmpCwd.data.sessionId;
    // 4. agent state via dispatch
    const state = await evalJs(`window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'get_state' }).then(r => r.ok ? { ok: true, streaming: r.data.isStreaming, model: r.data.model?.id } : r)`);
    step("agentCommand get_state", state?.ok === true, JSON.stringify(state));

    // 5. rename via wrapper
    const renamed = await evalJs(`window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'set_session_name', name: 'ipc-probe' }).then(r => ({ ok: r.ok, err: r.error }))`);
    step("set_session_name", renamed?.ok === true, JSON.stringify(renamed));

    // 6. real prompt -> reply (LLM). Short, single turn.
    const prompted = await evalJs(`window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'prompt', message: 'Reply with exactly: PROBE_OK' }).then(r => ({ ok: r.ok, err: r.error, code: r.code }))`);
    step("prompt accepted", prompted?.ok === true, JSON.stringify(prompted));

    if (prompted?.ok) {
      // Wait for the run to finish (prompt returns after preflight, not completion).
      const settled = await evalJs(`(async () => {
        for (let i = 0; i < 120; i++) {
          const r = await window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'get_state' });
          const st = r.ok ? r.data : null;
          if (st && !st.isStreaming && !st.isPromptRunning) return true;
          await new Promise((res) => setTimeout(res, 500));
        }
        return false;
      })()`);
      step("run settled", settled === true);

      const reply = await evalJs(`window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'get_last_assistant_text' }).then(r => r.ok ? r.data.text : 'ERR:' + r.error)`);
      step("assistant reply", typeof reply === "string" && reply.length > 0, String(reply).slice(0, 80));

      // 7. events push channel: connect, expect connected frame quickly
      const evts = await evalJs(`(async () => {
        const frames = [];
        const done = new Promise((resolve) => {
          const unsub = window.pi.subscribeAgentEvents(${JSON.stringify(sid)}, (f) => {
            frames.push(f.kind);
            const data = f.kind === 'event' ? JSON.parse(f.data) : null;
            if (data && data.type === 'connected') { unsub(); resolve({ connected: true, frames }); }
          });
          setTimeout(() => resolve({ connected: false, frames }), 8000);
        });
        return done;
      })()`);
      step("agent events connected frame", evts?.connected === true, JSON.stringify(evts));

      // 8. fork at the first persisted entry (the UI passes entryIds from context)
      const entryId = await evalJs(`window.pi.sessionsGet(${JSON.stringify(sid)}).then(r => (r.context?.entryIds ?? [])[0] ?? null)`);
      const fork = await evalJs(`window.pi.agentCommand(${JSON.stringify(sid)}, { type: 'fork', entryId: ${JSON.stringify(entryId)} }).then(r => ({ ok: r.ok, cancelled: r.data?.cancelled, newId: r.data?.newSessionId, err: r.error }))`);
      step("fork", fork?.ok === true && fork?.newId, JSON.stringify(fork));
      if (fork?.newId) {
        const del = await evalJs(`window.pi.sessionsDelete(${JSON.stringify(fork.newId)}).then(r => ({ ok: !('error' in r) || r.ok, r: r.ok ?? r }))`);
        step("sessionsDelete(fork)", Boolean(del?.ok), JSON.stringify(del).slice(0, 120));
      }
    }

    // cleanup probe session (never-persisted sessions just vanish with the wrapper)
    await evalJs(`window.pi.sessionsDelete(${JSON.stringify(sid)}).catch(() => null)`);
  }

  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "ALL GREEN" : `FAILURES: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

function list_ok() { return false; }

main().catch((e) => { console.error("probe error:", e.message); process.exit(2); });
