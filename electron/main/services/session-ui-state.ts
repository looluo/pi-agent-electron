/**
 * Port of app/api/sessions/ui-state (GET/POST): the sidebar's pins and
 * archive store. The route's request-security/content-type checks are the
 * IPC boundary's job; the semantics live in lib/session-ui-state.ts.
 */
import { SessionUiStateLockedError, readSessionUiState, updateSessionUiState } from "@/lib/session-ui-state";
import { parseSessionUiStateRequest, type SessionUiStateRequest } from "@/lib/session-ui-state-shared";

/** GET /api/sessions/ui-state. */
export function sessionUiStateGet(): { state: unknown } {
  return { state: readSessionUiState() };
}

/** POST /api/sessions/ui-state — one change; answers with the state after it. */
export async function sessionUiStatePost(request: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return { status: 400, body: { error: "Expected a request object", reason: "invalid-request" } };
  }
  const parsed = parseSessionUiStateRequest(request);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error, reason: "invalid-request" } };
  try {
    const state = await updateSessionUiState(parsed.request as SessionUiStateRequest);
    return { status: 200, body: { state } };
  } catch (error) {
    if (error instanceof SessionUiStateLockedError) return { status: 409, body: { error: error.message, reason: "locked" } };
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error), reason: "internal" } };
  }
}
