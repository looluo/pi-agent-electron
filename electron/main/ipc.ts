import { ipcMain, type WebContents } from "electron";
import { agentCommand, agentNew, agentState, agentBashOutput, agentBashOutputDownload, agentRunningIds } from "./services/agent";
import {
  sessionsAutoName,
  sessionsContext,
  sessionsDelete,
  sessionsGet,
  sessionsList,
  sessionsSearch,
  sessionsRename,
  sessionsThinking,
} from "./services/sessions";
import { dropAgentEvents, openAgentEvents } from "./services/agent-events";
import { openFileWatch } from "./services/files";
import { frameOf, terminalCreate, terminalKill, terminalResize, terminalSubscribe, terminalWrite } from "./services/terminal";
import type { IpcUploadFile } from "./services/files-upload";
import { filesUpload, filesUploadCheck } from "./services/files-upload";
import {
  cwdBrowse,
  cwdValidate,
  defaultCwd,
  fileIndex,
  gitDiff,
  gitStatus,
  home,
  projectTrustGet,
  projectTrustPost,
  worktreesDelete,
  worktreesGet,
  worktreesPost,
} from "./services/workspace";
import {
  subagentsAction,
  subagentsGetRun,
  subagentsProfilesDelete,
  subagentsProfilesList,
  subagentsProfilesSave,
  subagentsProfilesToggle,
  subagentsSettingsGet,
  subagentsSettingsPut,
} from "./services/subagents";
import { toolsSettingsGet, toolsSettingsPut } from "./services/tools-settings";

/** Route-era error semantics: resolve { error } instead of rejecting. */
async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

type WatchSub = {
  webContents: WebContents;
  close: () => void;
  onDestroyed: () => void;
};
const fileWatches = new Map<string, WatchSub>();

function pushEvent(webContents: WebContents, token: string, event: string, data: Record<string, unknown>): void {
  try {
    webContents.send(`pi:file-watch:${token}`, { event, data });
  } catch {
    // receiver gone; destroyed hook cleans up
  }
}

/**
 * Typed resource facade + agent:command dispatch (spec Q8).
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
  ipcMain.handle("pi:sessions:search", (_e, query: string) => sessionsSearch(query));
  ipcMain.handle("pi:sessions:get", (_e, id: string, options?: { deferThinking?: boolean; deferMedia?: boolean; tail?: number }) =>
    sessionsGet(id, options ?? {}));
  ipcMain.handle("pi:sessions:context", (_e, id: string, options?: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean; tail?: number; before?: string }) =>
    guard(() => sessionsContext(id, options ?? {})));
  ipcMain.handle("pi:sessions:rename", (_e, id: string, name: string) => guard(() => sessionsRename(id, name)));
  ipcMain.handle("pi:sessions:delete", (_e, id: string) => guard(() => sessionsDelete(id)));
  ipcMain.handle("pi:sessions:auto-name", (_e, id: string, options?: { skipIfNamed?: boolean }) => guard(() => sessionsAutoName(id, options)));
  ipcMain.handle("pi:sessions:thinking", (_e, id: string, entryId: string, blockIndex: number) =>
    guard(() => sessionsThinking(id, entryId, blockIndex)));

  // ---- files: upload (POST route port; GET goes through pifile://) -----------
  ipcMain.handle("pi:files:upload-check", (_e, directory: string, fileNames: string[]) =>
    filesUploadCheck(directory, fileNames));
  ipcMain.handle("pi:files:upload", (e, directory: string, files: IpcUploadFile[], conflict: string | null) =>
    filesUpload(directory, files, conflict, (done, total, fileName) => {
      pushEvent(e.sender, "progress", "upload-progress", { done, total, fileName });
    }));

  // ---- files: watch push -------------------------------------------------------
  ipcMain.handle("pi:file-watch:open", (e, token: string, filePath: string) => {
    if (fileWatches.has(token)) return null;
    const sub: WatchSub = {
      webContents: e.sender,
      close: () => {},
      onDestroyed: () => dropFileWatch(token),
    };
    fileWatches.set(token, sub);
    e.sender.once("destroyed", sub.onDestroyed);
    sub.close = openFileWatch(
      filePath,
      (event, data) => pushEvent(sub.webContents, token, event, data),
      () => pushEvent(sub.webContents, token, "closed", {}),
    );
    return null;
  });
  ipcMain.handle("pi:file-watch:close", (_e, token: string) => {
    dropFileWatch(token);
    return null;
  });

  // ---- terminal: workspace PTY tabs (upstream 9290c27+ce18006) -----------------
  type TerminalSub = WatchSub;
  const terminalSubs = new Map<string, TerminalSub>();
  const dropTerminalSub = (token: string): void => {
    const sub = terminalSubs.get(token);
    if (!sub) return;
    terminalSubs.delete(token);
    sub.close();
    try {
      sub.webContents.removeListener("destroyed", sub.onDestroyed);
    } catch {
      // webContents already destroyed
    }
  };
  ipcMain.handle("pi:terminal:create", (_e, cwd: string, cols: number, rows: number, id?: string) =>
    terminalCreate(cwd, cols, rows, id));
  ipcMain.handle("pi:terminal:subscribe", (e, token: string, id: string, after?: number) => {
    if (terminalSubs.has(token)) return { status: 400, body: { error: "token already subscribed" } };
    const sub: TerminalSub = {
      webContents: e.sender,
      close: () => {},
      onDestroyed: () => dropTerminalSub(token),
    };
    const result = terminalSubscribe(id, (event) => {
      try {
        sub.webContents.send(`pi:terminal:event:${token}`, frameOf(event));
      } catch {
        // receiver gone; destroyed hook cleans up
      }
    }, typeof after === "number" ? after : undefined);
    // The unsubscribe handle is a function and can never cross the structured
    // clone boundary — strip it before the invoke response (win-acceptance bug:
    // "An object could not be cloned" killed every terminal subscribe).
    const { unsubscribe, ...response } = result;
    if (result.status !== 200 || !unsubscribe) return response;
    terminalSubs.set(token, sub);
    e.sender.once("destroyed", sub.onDestroyed);
    sub.close = unsubscribe;
    return response;
  });
  ipcMain.handle("pi:terminal:unsubscribe", (_e, token: string) => {
    dropTerminalSub(token);
    return true;
  });
  ipcMain.handle("pi:terminal:write", (_e, id: string, data: string) => terminalWrite(id, data));
  ipcMain.handle("pi:terminal:resize", (_e, id: string, cols: number, rows: number) => terminalResize(id, cols, rows));
  ipcMain.handle("pi:terminal:kill", (_e, id: string) => terminalKill(id));

  // ---- workspace ---------------------------------------------------------------
  ipcMain.handle("pi:cwd:validate", (_e, cwd: string) => cwdValidate(cwd));
  ipcMain.handle("pi:cwd:browse", (_e, path: string | undefined) => cwdBrowse(path));
  ipcMain.handle("pi:default-cwd", () => defaultCwd());
  ipcMain.handle("pi:home", () => home());
  ipcMain.handle("pi:project-trust:get", (_e, cwd: string | null) => projectTrustGet(cwd));
  ipcMain.handle("pi:project-trust:post", (_e, cwd: unknown) => projectTrustPost(cwd));
  ipcMain.handle("pi:worktrees:get", (_e, cwd: string | null) => worktreesGet(cwd));
  ipcMain.handle("pi:worktrees:post", (_e, body: { cwd?: string; branch?: string }) => worktreesPost(body ?? {}));
  ipcMain.handle("pi:worktrees:delete", (_e, body: { cwd?: string; path?: string; force?: boolean }) => worktreesDelete(body ?? {}));
  ipcMain.handle("pi:git:status", (_e, cwd: string | null) => gitStatus(cwd));
  ipcMain.handle("pi:git:diff", (_e, cwd: string | null, path: string | null) => gitDiff(cwd, path));
  ipcMain.handle("pi:file-index", (_e, cwd: string | null, q: string | null) => fileIndex(cwd, q));

  // ---- subagents (upstream /api/subagents/** via typed IPC) ---------------------
  ipcMain.handle("pi:subagents:run", (_e, id: string) => subagentsGetRun(id));
  ipcMain.handle("pi:subagents:action", (_e, id: string, body: Record<string, unknown>) => subagentsAction(id, body ?? {}));
  ipcMain.handle("pi:subagents:profiles:list", (_e, cwd: unknown) => subagentsProfilesList(cwd));
  ipcMain.handle("pi:subagents:profiles:save", (_e, body: Record<string, unknown>) => subagentsProfilesSave(body ?? {}));
  ipcMain.handle("pi:subagents:profiles:toggle", (_e, body: Record<string, unknown>) => subagentsProfilesToggle(body ?? {}));
  ipcMain.handle("pi:subagents:profiles:delete", (_e, body: Record<string, unknown>) => subagentsProfilesDelete(body ?? {}));
  ipcMain.handle("pi:subagents:settings:get", () => subagentsSettingsGet());
  ipcMain.handle("pi:subagents:settings:put", (_e, enabled: unknown) => subagentsSettingsPut(enabled));

  // ---- tools settings -----------------------------------------------------------
  ipcMain.handle("pi:tools:settings:get", () => toolsSettingsGet());
  ipcMain.handle("pi:tools:settings:put", (_e, enabled: unknown) => toolsSettingsPut(enabled));
}

function dropFileWatch(token: string): void {
  const sub = fileWatches.get(token);
  if (!sub) return;
  fileWatches.delete(token);
  sub.close();
  try {
    sub.webContents.removeListener("destroyed", sub.onDestroyed);
  } catch {
    // webContents already destroyed
  }
}
