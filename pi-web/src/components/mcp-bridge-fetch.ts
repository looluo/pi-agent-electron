/**
 * Bridge fetch for the MCP panel (fork seam, sync v0.9.3 issue 09).
 *
 * Upstream's helpers speak HTTP to /api/mcp* with an injectable FetchLike;
 * the Electron renderer has no HTTP server. This adapter keeps every helper —
 * deadlines, refusal parsing, the cwd-refusal fallback — untouched by serving
 * those URLs from the typed IPC bridge and returning a DOM Response of the
 * same JSON shape the routes produced.
 */

/** RequestInit-compatible, like the helpers' FetchLike. */
export type BridgeFetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function invoke(channel: string, args: unknown[]): Promise<Response> {
  const pi = (window as unknown as { pi?: Record<string, ((...a: unknown[]) => Promise<{ status: number; body: Record<string, unknown> | null }>) | undefined> }).pi;
  const call = pi?.[channel];
  if (typeof call !== "function") {
    return jsonResponse(500, { error: `IPC channel ${channel} is unavailable`, reason: "internal" });
  }
  const result = await call(...args);
  return jsonResponse(result.status, result.body ?? { error: `HTTP ${result.status}` });
}

const MCP_SIGN_IN_FLOW = /^\/api\/mcp\/sign-in\/([^/?]+)$/;

/** In the renderer the typed bridge serves these URLs; under the node test
 *  harness (no window) the helpers behave exactly as upstream's, against the
 *  global fetch the tests mock. */
function bridgeAvailable(): boolean {
  return typeof window !== "undefined"
    && typeof (window as unknown as { pi?: { mcpOverview?: unknown } }).pi?.mcpOverview === "function";
}

export const mcpBridgeFetch: BridgeFetchLike = async (input, init) => {
  if (!bridgeAvailable()) return fetch(input, init);
  const url = new URL(input, "http://pi.local");
  const path = url.pathname;
  const method = init?.method ?? "GET";
  const rawBody = init?.body;
  const body: Record<string, unknown> = typeof rawBody === "string"
    ? JSON.parse(rawBody) as Record<string, unknown>
    : {};

  // GET /api/mcp?cwd=… — the overview
  if (path === "/api/mcp" && method === "GET") {
    const cwd = url.searchParams.get("cwd");
    return invoke("mcpOverview", [cwd]);
  }
  // POST /api/mcp — an action
  if (path === "/api/mcp" && method === "POST") {
    return invoke("mcpAction", [body]);
  }
  // POST /api/mcp/test
  if (path === "/api/mcp/test" && method === "POST") {
    return invoke("mcpTest", [body]);
  }
  // POST /api/mcp/sign-in — start
  if (path === "/api/mcp/sign-in" && method === "POST") {
    return invoke("mcpSignInStart", [body]);
  }
  // /api/mcp/sign-in/<flowId> — status / paste / cancel
  const flow = MCP_SIGN_IN_FLOW.exec(path);
  if (flow) {
    if (method === "GET") return invoke("mcpSignInStatus", [flow[1]]);
    if (method === "POST") return invoke("mcpSignInPaste", [flow[1], body.redirectUrl]);
    if (method === "DELETE") return invoke("mcpSignInCancel", [flow[1]]);
  }
  return jsonResponse(404, { error: `The MCP bridge does not serve ${method} ${path}`, reason: "invalid-request" });
};
