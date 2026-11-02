import type { SessionInfo } from "./types";

/** The fork route's refusals of a side chat, as translated notices. */
export const SIDE_REFUSAL_MESSAGES = {
  not_found: "sideChat.error.notFound",
  unsaved: "sideChat.error.unsaved",
  empty: "sideChat.error.empty",
  subagent: "sideChat.error.subagent",
  side: "sideChat.error.side",
} as const;

/** Fork a session into a side chat. `name` is what to call it instead of its first message's first line.
 *  Fork transport: the `pi:sessions:fork` IPC (options side/name), re-homed from upstream's POST route. */
export async function createSideChat(
  sourceSessionId: string,
  translate: (key: (typeof SIDE_REFUSAL_MESSAGES)[keyof typeof SIDE_REFUSAL_MESSAGES]) => string,
  name?: string,
): Promise<{ session: SessionInfo } | { error: string }> {
  const res = await window.pi.sessionsFork(sourceSessionId, { side: true, ...(name ? { name } : {}) });
  const body = (res.body ?? {}) as
    | { sessionId?: string; session?: SessionInfo; code?: string; error?: string }
    | null;
  if (res.status === 200 && body?.sessionId && body.session) return { session: body.session };
  return {
    error: body?.code && body.code in SIDE_REFUSAL_MESSAGES
      ? translate(SIDE_REFUSAL_MESSAGES[body.code as keyof typeof SIDE_REFUSAL_MESSAGES])
      : body?.error ?? `HTTP ${res.status}`,
  };
}
