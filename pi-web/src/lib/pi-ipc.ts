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
  sessionsGet(id: string, options?: { deferThinking?: boolean; deferMedia?: boolean; tail?: number }): Promise<unknown>;
  sessionsContext(id: string, options?: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean; tail?: number; before?: string }): Promise<unknown>;
  sessionsRename(id: string, name: string): Promise<unknown>;
  sessionsDelete(id: string): Promise<unknown>;
  sessionsAutoName(id: string): Promise<unknown>;
  sessionsThinking(id: string, entryId: string, blockIndex: number): Promise<unknown>;

  filesUploadCheck(directory: string, fileNames: string[]): Promise<{ status: number; body: Record<string, unknown> | null }>;
  filesUpload(directory: string, files: Array<{ name: string; bytes: Uint8Array }>, conflict: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  onUploadProgress(listener: (progress: { done: number; total: number; fileName: string }) => void): () => void;
  subscribeFileWatch(filePath: string, onFrame: (frame: { event: string; data: Record<string, unknown> }) => void): () => void;

  cwdValidate(cwd: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  cwdBrowse(path?: string): Promise<unknown>;
  defaultCwd(): Promise<{ cwd?: string; error?: string }>;
  home(): Promise<{ home?: string }>;
  projectTrustGet(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  projectTrustPost(cwd: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  worktreesGet(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  worktreesPost(body: { cwd?: string; branch?: string }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  worktreesDelete(body: { cwd?: string; path?: string; force?: boolean }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  gitStatus(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  gitDiff(cwd: string | null, path: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  fileIndex(cwd: string | null, q?: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;

  models(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  modelsConfigGet(): Promise<Record<string, unknown>>;
  modelsConfigPut(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  modelsTest(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  modelsDiscover(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  modelsCatalog(q: string, provider: string, limit: number): Promise<{ status: number; body: Record<string, unknown> | null }>;
  authProviders(): Promise<{ providers?: unknown[] }>;
  authAllProviders(): Promise<{ providers?: unknown[] }>;
  apiKeyStatus(provider: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  apiKeySet(provider: string, apiKey: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  apiKeyDelete(provider: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  authLogout(provider: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  authLoginCode(provider: string, token: string, code: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subscribeAuthLogin(provider: string, onFrame: (frame: { event: string; data: Record<string, unknown> }) => void): () => void;
  appUpdate(): Promise<{ status: number; body: Record<string, unknown> | null }>;

  skillsList(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  skillsToggle(filePath: string, disable: boolean): Promise<{ status: number; body: Record<string, unknown> | null }>;
  skillsCheck(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  skillsInstall(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  skillsSearch(query: string, limit?: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  skillsUpdate(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  pluginsList(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> | null }>;
  pluginsAction(body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsRun(id: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsAction(id: string, body: { action?: string; message?: string }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsProfilesList(cwd: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsProfilesSave(body: { cwd: string; scope: string; profile: unknown }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsProfilesToggle(body: { cwd: string; scope: string; name: string; enabled: boolean }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsProfilesDelete(body: { cwd: string; scope: string; name: string }): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsSettingsGet(): Promise<{ status: number; body: Record<string, unknown> | null }>;
  subagentsSettingsPut(enabled: boolean): Promise<{ status: number; body: Record<string, unknown> | null }>;
  sessionExport(id: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
}

export function bridge(): PiBridge {
  const pi = (window as { pi?: PiBridge }).pi;
  if (!pi) throw new Error("Electron bridge (window.pi) is unavailable");
  return pi;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** EventSource-shaped adapter over the OAuth login push channel. */
export class IpcAuthLoginSource {
  onmessage: ((event: { data: Record<string, unknown> }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private settled = false;

  constructor(provider: string) {
    this.unsubscribe = bridge().subscribeAuthLogin(provider, (frame) => {
      if (frame.event === "error" && frame.data.type === "startup") {
        this.onerror?.(new Event("error"));
        return;
      }
      // Terminal frames close the stream, mirroring SSE stream close.
      if (frame.data.type === "success" || frame.data.type === "error" || frame.data.type === "cancelled") {
        if (!this.settled) {
          this.settled = true;
          this.onmessage?.({ data: frame.data });
        }
        return;
      }
      this.onmessage?.({ data: frame.data });
    });
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

/** EventSource-shaped adapter over the file-watch push channel. */
export class IpcFileWatchSource {
  onerror: ((event: unknown) => void) | null = null;
  private listeners = new Map<string, Set<(event: { data: string }) => void>>();
  private unsubscribe: (() => void) | null = null;

  constructor(filePath: string, sourceSessionId?: string | null) {
    void sourceSessionId; // gating happens in main (allowed roots + session refs)
    this.unsubscribe = bridge().subscribeFileWatch(filePath, (frame) => {
      if (frame.event === "closed") {
        this.onerror?.(new Event("error"));
        return;
      }
      const set = this.listeners.get(frame.event);
      if (set) {
        for (const listener of set) listener({ data: JSON.stringify(frame.data ?? {}) });
      }
    });
  }

  addEventListener(eventName: string, listener: (event: { data: string }) => void): void {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName)!.add(listener);
  }

  removeEventListener(eventName: string, listener: (event: { data: string }) => void): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}
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
