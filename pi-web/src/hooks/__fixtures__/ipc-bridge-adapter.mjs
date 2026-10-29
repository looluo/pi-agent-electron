// Fork test fixture: adapts the upstream HTTP-mock harness to this fork's
// typed IPC bridge. The ported VM-scripted hook tests (send-recovery,
// hidden-page-stream, agent-phase, …) mock `globalThis.fetch` against the
// upstream /api routes and assert on the request URL list, and drive the
// event stream through a `globalThis.EventSource` mock. The hook here calls
// window.pi.* / bridge().subscribeAgentEvents instead; installIpcBridgeAdapter()
// wires each bridge method onto the same fetch mock and the same EventSource
// mock, so every URL-based assertion keeps its upstream meaning untouched.

/** The window.pi + bridge() surface useAgentSession, agent-client and
 *  IpcAgentEventSource call. */
export function installIpcBridgeAdapter() {
  const call = async (url, init) => {
    const response = await globalThis.fetch(url, init);
    if (!response.ok) return null;
    return response.json();
  };
  const agent = {
    // GET /api/agent/[id] — the slimmed status read (#1302).
    agentState: (sessionId) => call(`/api/agent/${encodeURIComponent(sessionId)}`),
    // POST /api/agent/[id]/lease — the lease reply body, unwrapped.
    agentLease: (sessionId) => call(`/api/agent/${encodeURIComponent(sessionId)}/lease`, { method: "POST" }),
    // POST /api/agent/[id] — commands; the mock answers {success, data}.
    agentCommand: async (sessionId, command) => {
      const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) };
      const response = await globalThis.fetch(`/api/agent/${encodeURIComponent(sessionId)}`, init);
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) return { ok: false, error: body.error ?? `HTTP ${response.status}`, code: body.code, accepted: body.accepted, ...body };
      return { ok: true, data: body.data ?? null };
    },
    // /api/agent/new — the fork's bridge takes the ensure_session command
    // object; the route answers the fresh session id either way.
    agentNew: async (payload) => {
      if (payload && typeof payload === "object") {
        // The fork's bridge: IpcResult envelope around the route's body.
        const response = await globalThis.fetch("/api/agent/new", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        return response.ok ? { ok: true, data: body } : { ok: false, error: body?.error ?? `HTTP ${response.status}` };
      }
      const query = payload ? `?cwd=${encodeURIComponent(payload)}` : "";
      return call(`/api/agent/new${query}`);
    },
    // GET /api/models
    models: async () => {
      const response = await globalThis.fetch("/api/models");
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    sessionsGet: (sessionId) => call(`/api/sessions/${encodeURIComponent(sessionId)}?format=summary`),
    sessionsContext: (sessionId) => call(`/api/sessions/${encodeURIComponent(sessionId)}/state`),
    sessionsAutoName: (sessionId) => call(`/api/sessions/${encodeURIComponent(sessionId)}/auto-name`, { method: "POST" }),
    agentRunning: () => call("/api/agent/running"),
    // The event stream: an EventSource the tests can drive, translated into
    // IpcAgentEventSource frames (open / event / closed).
    subscribeAgentEvents: (sessionId, onFrame) => {
      const source = new globalThis.EventSource(`/api/agent/${encodeURIComponent(sessionId)}/events?holder=electron-main`);
      let opened = false;
      source.onmessage = (message) => {
        // The mock flips readyState to 1 inside emit(); mirror the first
        // message as the IPC open frame.
        if (!opened) { opened = true; onFrame({ kind: "open" }); }
        onFrame({ kind: "event", data: message.data });
      };
      source.onerror = () => onFrame({ kind: "closed" });
      return () => source.close();
    },
  };
  globalThis.window ??= new EventTarget();
  globalThis.window.pi = agent;
  globalThis.__piIpcBridge = agent;
  return agent;
}
