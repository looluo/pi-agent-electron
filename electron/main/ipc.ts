import { ipcMain } from "electron";

/**
 * Main-process IPC surface. Slice 1 (agent+sessions) replaces this ping stub
 * with the typed resource facades and the agent:command dispatch channel.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle("pi:ping", () => "pong");
}
