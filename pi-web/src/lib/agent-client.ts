// Client-side helper for the agent:command dispatch channel.
//
// Main returns one of:
//   { ok: true, data: <result> }
//   { ok: false, error, code?, accepted?, notFound? }
//
// Same call sites as the retired fetch helper; AgentCommandError keeps the
// code/accepted semantics prompt rejection handling depends on.

import { missingCwdFromBody } from "./missing-cwd";

export class AgentCommandError extends Error {
  constructor(
    message: string,
    public readonly notFound: boolean = false,
    public readonly code?: string,
    public readonly accepted?: boolean,
    /** The session's folder, when the refusal is that it no longer exists (#1422). */
    public readonly missingCwd?: string,
  ) {
    super(message);
    this.name = "AgentCommandError";
  }
}

export function isPromptRejectedError(error: unknown): error is AgentCommandError {
  return error instanceof AgentCommandError
    && error.code === "prompt_rejected"
    && error.accepted === false;
}

/**
 * GET /api/agent/[id] without the system prompt, for status reads: the usage read after each
 * reply and on every stream connect, the settle and reconcile polls. None of them shows the
 * prompt, and it is nearly all of the reply (context files, skills, tool notes: hundreds of KB
 * in a large project), fetched again after every model call (#1302).
 */
export function agentStatusUrl(sessionId: string): string {
  return `/api/agent/${encodeURIComponent(sessionId)}?systemPrompt=0`;
}

export async function sendAgentCommand<T = unknown>(
  sessionId: string,
  command: Record<string, unknown>,
): Promise<T> {
  const result = await window.pi.agentCommand(sessionId, command);
  if (!result.ok) {
    throw new AgentCommandError(
      result.error,
      Boolean(result.notFound),
      result.code,
      result.accepted,
      missingCwdFromBody(result) ?? undefined,
    );
  }
  return result.data as T;
}
