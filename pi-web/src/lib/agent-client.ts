// Client-side helper for the agent:command dispatch channel.
//
// Main returns one of:
//   { ok: true, data: <result> }
//   { ok: false, error, code?, accepted?, notFound? }
//
// Same call sites as the retired fetch helper; AgentCommandError keeps the
// code/accepted semantics prompt rejection handling depends on.

export class AgentCommandError extends Error {
  constructor(
    message: string,
    public readonly notFound: boolean = false,
    public readonly code?: string,
    public readonly accepted?: boolean,
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

export async function sendAgentCommand<T = unknown>(
  sessionId: string,
  command: Record<string, unknown>,
): Promise<T> {
  const result = await window.pi.agentCommand(sessionId, command);
  if (!result.ok) {
    throw new AgentCommandError(result.error, Boolean(result.notFound), result.code, result.accepted);
  }
  return result.data as T;
}
