import { contextBridge, ipcRenderer } from "electron";

/**
 * Typed renderer facade (spec Q8): resource APIs are named methods; agent
 * commands go through the single dispatch channel. Event push uses
 * subscribe/unsubscribe pairs that return disposers.
 */

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; accepted?: boolean; notFound?: boolean };

type AgentEventFrame =
  | { kind: "open" }
  | { kind: "event"; data: string }
  | { kind: "closed" };

const token = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

contextBridge.exposeInMainWorld("pi", {
  // agent
  agentNew: (body: unknown) => ipcRenderer.invoke("pi:agent:new", body),
  agentCommand: (sessionId: string, command: unknown) =>
    ipcRenderer.invoke("pi:agent:command", sessionId, command),
  agentState: (sessionId: string) => ipcRenderer.invoke("pi:agent:state", sessionId),
  agentRunning: () => ipcRenderer.invoke("pi:agent:running"),
  agentBashOutput: (sessionId: string, path: string) =>
    ipcRenderer.invoke("pi:agent:bash-output", sessionId, path),
  agentBashOutputDownload: (sessionId: string, path: string) =>
    ipcRenderer.invoke("pi:agent:bash-output:download", sessionId, path),

  // agent events (EventSource-shaped push)
  subscribeAgentEvents(sessionId: string, onFrame: (frame: AgentEventFrame) => void): () => void {
    const subToken = token();
    const channel = `pi:agent-events:${sessionId}`;
    const handler = (_e: Electron.IpcRendererEvent, frame: AgentEventFrame) => onFrame(frame);
    ipcRenderer.on(channel, handler);
    void ipcRenderer.invoke("pi:agent:events:open", subToken, sessionId);
    return () => {
      ipcRenderer.removeListener(channel, handler);
      void ipcRenderer.invoke("pi:agent:events:close", subToken);
    };
  },

  // sessions
  sessionsList: (force?: boolean) => ipcRenderer.invoke("pi:sessions:list", force),
  sessionsGet: (id: string, options?: { deferThinking?: boolean; deferMedia?: boolean }) =>
    ipcRenderer.invoke("pi:sessions:get", id, options),
  sessionsContext: (id: string, options?: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean }) =>
    ipcRenderer.invoke("pi:sessions:context", id, options),
  sessionsRename: (id: string, name: string) => ipcRenderer.invoke("pi:sessions:rename", id, name),
  sessionsDelete: (id: string) => ipcRenderer.invoke("pi:sessions:delete", id),
  sessionsAutoName: (id: string) => ipcRenderer.invoke("pi:sessions:auto-name", id),
  sessionsThinking: (id: string, entryId: string, blockIndex: number) =>
    ipcRenderer.invoke("pi:sessions:thinking", id, entryId, blockIndex),

  // files: upload + watch (GET goes through the pifile:// protocol)
  filesUploadCheck: (directory: string, fileNames: string[]) =>
    ipcRenderer.invoke("pi:files:upload-check", directory, fileNames),
  filesUpload: (directory: string, files: Array<{ name: string; bytes: Uint8Array }>, conflict: string | null) =>
    ipcRenderer.invoke("pi:files:upload", directory, files, conflict),
  onUploadProgress(listener: (progress: { done: number; total: number; fileName: string }) => void): () => void {
    const handler = (_e: Electron.IpcRendererEvent, payload: { event: string; data: { done: number; total: number; fileName: string } }) => {
      if (payload.event === "upload-progress") listener(payload.data);
    };
    ipcRenderer.on("pi:file-watch:progress", handler);
    return () => ipcRenderer.removeListener("pi:file-watch:progress", handler);
  },
  subscribeFileWatch(filePath: string, onFrame: (frame: { event: string; data: Record<string, unknown> }) => void): () => void {
    const subToken = token();
    const channel = `pi:file-watch:${subToken}`;
    const handler = (_e: Electron.IpcRendererEvent, frame: { event: string; data: Record<string, unknown> }) => onFrame(frame);
    ipcRenderer.on(channel, handler);
    void ipcRenderer.invoke("pi:file-watch:open", subToken, filePath);
    return () => {
      ipcRenderer.removeListener(channel, handler);
      void ipcRenderer.invoke("pi:file-watch:close", subToken);
    };
  },

  // workspace
  cwdValidate: (cwd: string) => ipcRenderer.invoke("pi:cwd:validate", cwd),
  cwdBrowse: (path?: string) => ipcRenderer.invoke("pi:cwd:browse", path),
  defaultCwd: () => ipcRenderer.invoke("pi:default-cwd"),
  home: () => ipcRenderer.invoke("pi:home"),
  projectTrustGet: (cwd: string | null) => ipcRenderer.invoke("pi:project-trust:get", cwd),
  projectTrustPost: (cwd: unknown) => ipcRenderer.invoke("pi:project-trust:post", cwd),
  worktreesGet: (cwd: string | null) => ipcRenderer.invoke("pi:worktrees:get", cwd),
  worktreesPost: (body: { cwd?: string; branch?: string }) => ipcRenderer.invoke("pi:worktrees:post", body),
  worktreesDelete: (body: { cwd?: string; path?: string; force?: boolean }) => ipcRenderer.invoke("pi:worktrees:delete", body),
  gitStatus: (cwd: string | null) => ipcRenderer.invoke("pi:git:status", cwd),
  gitDiff: (cwd: string | null, path: string | null) => ipcRenderer.invoke("pi:git:diff", cwd, path),
  fileIndex: (cwd: string | null, q?: string | null) => ipcRenderer.invoke("pi:file-index", cwd, q),

  // models & auth
  models: (cwd: string | null) => ipcRenderer.invoke("pi:models", cwd),
  modelsConfigGet: () => ipcRenderer.invoke("pi:models-config:get"),
  modelsConfigPut: (body: unknown) => ipcRenderer.invoke("pi:models-config:put", body),
  modelsTest: (body: unknown) => ipcRenderer.invoke("pi:models-config:test", body),
  modelsDiscover: (body: unknown) => ipcRenderer.invoke("pi:models-config:discover", body),
  modelsCatalog: (q: string, provider: string, limit: number) => ipcRenderer.invoke("pi:models-config:catalog", q, provider, limit),
  authProviders: () => ipcRenderer.invoke("pi:auth:providers"),
  authAllProviders: () => ipcRenderer.invoke("pi:auth:all-providers"),
  apiKeyStatus: (provider: string) => ipcRenderer.invoke("pi:auth:api-key:get", provider),
  apiKeySet: (provider: string, apiKey: string) => ipcRenderer.invoke("pi:auth:api-key:set", provider, apiKey),
  apiKeyDelete: (provider: string) => ipcRenderer.invoke("pi:auth:api-key:delete", provider),
  authLogout: (provider: string) => ipcRenderer.invoke("pi:auth:logout", provider),
  authLoginCode: (provider: string, token: string, code: string) => ipcRenderer.invoke("pi:auth:login:code", provider, token, code),
  subscribeAuthLogin(provider: string, onFrame: (frame: { event: string; data: Record<string, unknown> }) => void): () => void {
    const subToken = token();
    const channel = `pi:auth-login:${subToken}`;
    const handler = (_e: Electron.IpcRendererEvent, frame: { event: string; data: Record<string, unknown> }) => onFrame(frame);
    ipcRenderer.on(channel, handler);
    void ipcRenderer.invoke("pi:auth:login:open", subToken, provider);
    return () => {
      ipcRenderer.removeListener(channel, handler);
      void ipcRenderer.invoke("pi:auth:login:close", subToken);
    };
  },
  appUpdate: () => ipcRenderer.invoke("pi:app-update"),
});
