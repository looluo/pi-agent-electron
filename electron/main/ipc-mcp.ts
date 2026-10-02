import { ipcMain } from "electron";
import {
  mcpAction,
  mcpOverview,
  mcpSignInCancel,
  mcpSignInPaste,
  mcpSignInStart,
  mcpSignInStatus,
  mcpTest,
} from "./services/mcp";

/** Port of app/api/mcp (ADR 0006): Settings › MCP rides typed IPC channels
 *  instead of the HTTP surface; the sign-in flow polls by id like the route. */
export function registerMcpHandlers(): void {
  ipcMain.handle("pi:mcp:overview", (_e, cwd: string | null) => mcpOverview(cwd));
  ipcMain.handle("pi:mcp:action", (_e, body: unknown) => mcpAction(body));
  ipcMain.handle("pi:mcp:test", (_e, body: unknown) => mcpTest(body));
  ipcMain.handle("pi:mcp:sign-in:start", (_e, body: unknown) => mcpSignInStart(body));
  ipcMain.handle("pi:mcp:sign-in:status", (_e, flowId: string) => mcpSignInStatus(flowId));
  ipcMain.handle("pi:mcp:sign-in:paste", (_e, flowId: string, redirectUrl: unknown) => mcpSignInPaste(flowId, redirectUrl));
  ipcMain.handle("pi:mcp:sign-in:cancel", (_e, flowId: string) => mcpSignInCancel(flowId));
}
