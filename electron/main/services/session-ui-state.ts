/**
 * Port of app/api/sessions/ui-state (GET/POST): the sidebar's pins and
 * archive store. The route's request-security/content-type checks are the
 * IPC boundary's job; the semantics live in lib/session-ui-state.ts.
 *
 * Both answers carry the route's response body as-is — `{ state }` after a
 * write, `{ error, reason }` on a refusal — so the renderer's readState
 * sees the same shapes the web form did.
 */
import { SessionUiStateLockedError, readSessionUiState, updateSessionUiState } from "@/lib/session-ui-state";
import { parseSessionUiStateRequest } from "@/lib/session-ui-state-shared";

/** GET /api/sessions/ui-state. */
export function sessionUiStateGet(): { state: unknown } {
  return { state: readSessionUiState() };
}

/** POST /api/sessions/ui-state — one change; answers with the state after it. */
export async function sessionUiStatePost(request: unknown): Promise<{ state?: unknown; error?: string; reason?: string }> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return { error: "Expected a request object", reason: "invalid-request" };
  }
  const parsed = parseSessionUiStateRequest(request);
  if (!parsed.ok) return { error: parsed.error, reason: "invalid-request" };
  try {
    const state = await updateSessionUiState(parsed.request);
    return { state };
  } catch (error) {
    if (error instanceof SessionUiStateLockedError) return { error: error.message, reason: "locked" };
    return { error: error instanceof Error ? error.message : String(error), reason: "internal" };
  }
}
