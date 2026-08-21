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
});
