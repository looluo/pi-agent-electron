/**
 * Renderer transport over the Electron preload bridge.
 *
 * - unwrap() maps the main-process IpcResult onto the same error class the
 *   retired HTTP client produced, so AgentCommandError semantics (code,
 *   accepted) survive the transport swap unchanged.
 * - IpcAgentEventSource implements AgentEventSourceLike (the EventSource shape
 *   lib/agent-event-connection already abstracts), so the handshake/reconnect
 *   logic keeps working without modification.
 */
import type { AgentEventSourceLike } from "./agent-event-connection";

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; accepted?: boolean; notFound?: boolean };

export type AgentEventFrame =
  | { kind: "open" }
  | { kind: "event"; data: string }
  | { kind: "closed" };

export class IpcError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly accepted?: boolean,
    public readonly notFound?: boolean,
  ) {
    super(message);
    this.name = "IpcError";
  }
}

export function unwrap<T>(result: IpcResult<T>): T {
  if (result.ok) return result.data;
  throw new IpcError(result.error, result.code, result.accepted, result.notFound);
}

export interface PiBridge {
  agentNew(body: unknown): Promise<IpcResult<{
    sessionId: string;
    data: unknown;
    model: { provider: string; modelId: string } | null;
    thinkingLevel?: string;
  }>>;
  agentCommand(sessionId: string, command: unknown): Promise<IpcResult<unknown>>;
  agentState(sessionId: string): Promise<{ running: boolean; state?: unknown }>;
  agentRunning(): Promise<{ runningSessionIds: string[] }>;
  agentBashOutput(sessionId: string, path: string): Promise<IpcResult<{ output: string }>>;
  agentBashOutputDownload(sessionId: string, path: string): Promise<IpcResult<{ output: string }>>;
  subscribeAgentEvents(sessionId: string, onFrame: (frame: AgentEventFrame) => void): () => void;
  sessionsList(force?: boolean): Promise<unknown>;
  sessionsGet(id: string, options?: { deferThinking?: boolean; deferMedia?: boolean }): Promise<unknown>;
  sessionsContext(id: string, options?: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean }): Promise<unknown>;
  sessionsRename(id: string, name: string): Promise<unknown>;
  sessionsDelete(id: string): Promise<unknown>;
  sessionsAutoName(id: string): Promise<unknown>;
  sessionsThinking(id: string, entryId: string, blockIndex: number): Promise<unknown>;
}

export function bridge(): PiBridge {
  const pi = (window as { pi?: PiBridge }).pi;
  if (!pi) throw new Error("Electron bridge (window.pi) is unavailable");
  return pi;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** EventSource-shaped adapter over the agent-events push channel. */
export class IpcAgentEventSource implements AgentEventSourceLike {
  readonly readyState: number = CONNECTING;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private disposed = false;

  constructor(sessionId: string) {
    this.unsubscribe = bridge().subscribeAgentEvents(sessionId, (frame) => {
      if (this.disposed) return;
      if (frame.kind === "open") {
        (this as { readyState: number }).readyState = OPEN;
      } else if (frame.kind === "event") {
        this.onmessage?.({ data: frame.data });
      } else if (frame.kind === "closed") {
        (this as { readyState: number }).readyState = CLOSED;
        this.onerror?.(new Event("error"));
      }
    });
  }

  close(): void {
    this.disposed = true;
    (this as { readyState: number }).readyState = CLOSED;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
