import { ipcMain } from "electron";
import { agentCommand, agentNew, agentState, agentBashOutput, agentBashOutputDownload, agentRunningIds } from "./services/agent";
import {
  sessionsAutoName,
  sessionsContext,
  sessionsDelete,
  sessionsGet,
  sessionsList,
  sessionsRename,
  sessionsThinking,
} from "./services/sessions";
import { dropAgentEvents, openAgentEvents } from "./services/agent-events";

/** Route-era error semantics: resolve { error } instead of rejecting. */
async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Typed resource facade + agent:command dispatch (spec Q8).
 * Slices 2+ register further services here.
 */
export function registerIpcHandlers(): void {
  // ---- agent ----------------------------------------------------------------
  ipcMain.handle("pi:agent:new", (_e, body) => agentNew(body));
  ipcMain.handle("pi:agent:command", (_e, sessionId: string, command: Record<string, unknown>) =>
    agentCommand(sessionId, command));
  ipcMain.handle("pi:agent:state", (_e, sessionId: string) => agentState(sessionId));
  ipcMain.handle("pi:agent:running", () => agentRunningIds());
  ipcMain.handle("pi:agent:bash-output", (_e, sessionId: string, path: string) =>
    agentBashOutput(sessionId, path));
  ipcMain.handle("pi:agent:bash-output:download", (_e, sessionId: string, path: string) =>
    agentBashOutputDownload(sessionId, path));

  // ---- agent event push -------------------------------------------------------
  ipcMain.handle("pi:agent:events:open", (e, token: string, sessionId: string) =>
    openAgentEvents(e.sender, token, sessionId));
  ipcMain.handle("pi:agent:events:close", (_e, token: string) => {
    dropAgentEvents(token);
    return null;
  });

  // ---- sessions ---------------------------------------------------------------
  ipcMain.handle("pi:sessions:list", (_e, force?: boolean) => sessionsList(Boolean(force)));
  ipcMain.handle("pi:sessions:get", (_e, id: string, options?: { deferThinking?: boolean; deferMedia?: boolean }) =>
    sessionsGet(id, options ?? {}));
  ipcMain.handle("pi:sessions:context", (_e, id: string, options?: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean }) =>
    guard(() => sessionsContext(id, options ?? {})));
  ipcMain.handle("pi:sessions:rename", (_e, id: string, name: string) => guard(() => sessionsRename(id, name)));
  ipcMain.handle("pi:sessions:delete", (_e, id: string) => guard(() => sessionsDelete(id)));
  ipcMain.handle("pi:sessions:auto-name", (_e, id: string) => guard(() => sessionsAutoName(id)));
  ipcMain.handle("pi:sessions:thinking", (_e, id: string, entryId: string, blockIndex: number) =>
    guard(() => sessionsThinking(id, entryId, blockIndex)));
}
