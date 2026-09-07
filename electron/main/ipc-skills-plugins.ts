import { ipcMain, shell } from "electron";
import {
  skillsCheck,
  skillsInstall,
  skillsList,
  skillsSearch,
  skillsToggle,
  skillsUpdate,
} from "./services/skills";
import { pluginsAction, pluginsCheck, pluginsList } from "./services/plugins";
import { sessionExport } from "./services/export";

export function registerSkillsPluginsHandlers(): void {
  // skills
  ipcMain.handle("pi:skills:list", (_e, cwd: string | null) => skillsList(cwd));
  ipcMain.handle("pi:skills:toggle", (_e, filePath: string, disable: boolean) => skillsToggle(filePath, disable));
  ipcMain.handle("pi:skills:check", (_e, body: Record<string, unknown>) => skillsCheck(body ?? {}));
  ipcMain.handle("pi:skills:install", (_e, body: Record<string, unknown>) => skillsInstall(body ?? {}));
  ipcMain.handle("pi:skills:search", (_e, query: string, limit: unknown) => skillsSearch(query, limit));
  ipcMain.handle("pi:skills:update", (_e, body: Record<string, unknown>) => skillsUpdate(body ?? {}));

  // plugins
  ipcMain.handle("pi:plugins:list", (_e, cwd: string | null) => pluginsList(cwd));
  ipcMain.handle("pi:plugins:check", (_e, body: Record<string, unknown>) =>
    pluginsCheck(body as Parameters<typeof pluginsCheck>[0]));
  ipcMain.handle("pi:plugins:action", (_e, body: Record<string, unknown>) =>
    pluginsAction(body as Parameters<typeof pluginsAction>[0]));

  // export
  ipcMain.handle("pi:sessions:export", async (_e, id: string) => {
    const result = await sessionExport(id);
    if (result.status === 200 && typeof result.body.path === "string") {
      void shell.openPath(result.body.path);
    }
    return result;
  });
}
