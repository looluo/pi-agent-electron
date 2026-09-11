import { ipcMain, type WebContents } from "electron";
import {
  apiKeyDelete,
  apiKeySet,
  apiKeyStatus,
  appUpdateStatus,
  authAllProviders,
  authLoginCode,
  authLoginStart,
  authLogout,
  authProviders,
  modelsCatalog,
  modelsConfigGet,
  modelsConfigPut,
  modelsDiscover,
  modelsGet,
  modelsTest,
  type AuthLoginFrame,
} from "./services/models-auth";
import { providerUsageQuery } from "./services/provider-usage";

type LoginSession = {
  webContents: WebContents;
  token: string;
  cleanups: Array<() => void>;
  onDestroyed: () => void;
};
const loginSessions = new Map<string, LoginSession>();

function registerModelsAuthHandlers(): void {
  // models
  ipcMain.handle("pi:models", (_e, cwd: string | null) => modelsGet(cwd));
  ipcMain.handle("pi:models-config:get", () => modelsConfigGet());
  ipcMain.handle("pi:models-config:put", (_e, body: Record<string, unknown> | undefined | null) => modelsConfigPut(body));
  ipcMain.handle("pi:models-config:test", (_e, body: Record<string, unknown>) => modelsTest(body ?? {}));
  ipcMain.handle("pi:models-config:discover", (_e, body: Record<string, unknown>) => modelsDiscover(body ?? {}));
  ipcMain.handle("pi:models-config:catalog", (_e, q: string, provider: string, limit: number) =>
    modelsCatalog(q ?? "", provider ?? "", Number.isFinite(limit) ? limit : 50));

  // auth
  ipcMain.handle("pi:auth:providers", () => authProviders());
  ipcMain.handle("pi:auth:all-providers", () => authAllProviders());
  ipcMain.handle("pi:auth:api-key:get", (_e, provider: string) => apiKeyStatus(provider));
  ipcMain.handle("pi:provider-usage:query", (_e, providerId: unknown) => providerUsageQuery(providerId));
  ipcMain.handle("pi:auth:api-key:set", (_e, provider: string, apiKey: unknown) => apiKeySet(provider, apiKey));
  ipcMain.handle("pi:auth:api-key:delete", (_e, provider: string) => apiKeyDelete(provider));
  ipcMain.handle("pi:auth:logout", (_e, provider: string) => authLogout(provider));
  ipcMain.handle("pi:auth:login:code", (_e, provider: string, token: string, code: string) =>
    authLoginCode(provider, token, code));

  // auth login push session
  ipcMain.handle("pi:auth:login:open", (e, token: string, provider: string) => {
    if (loginSessions.has(token)) return null;
    const session: LoginSession = {
      webContents: e.sender,
      token,
      cleanups: [],
      onDestroyed: () => dropLoginSession(token),
    };
    loginSessions.set(token, session);
    e.sender.once("destroyed", session.onDestroyed);

    const push = (frame: AuthLoginFrame) => {
      try {
        session.webContents.send(`pi:auth-login:${token}`, frame);
      } catch {
        // receiver gone
      }
    };

    void authLoginStart(provider, push, (cleanup) => session.cleanups.push(cleanup));
    return null;
  });
  ipcMain.handle("pi:auth:login:close", (_e, token: string) => {
    dropLoginSession(token);
    return null;
  });

  // app-update (GitHub Releases source, spec Q13)
  ipcMain.handle("pi:app-update", () => appUpdateStatus());
}

function dropLoginSession(token: string): void {
  const session = loginSessions.get(token);
  if (!session) return;
  loginSessions.delete(token);
  for (const cleanup of session.cleanups) {
    try { cleanup(); } catch { /* ignore */ }
  }
  try {
    session.webContents.removeListener("destroyed", session.onDestroyed);
  } catch {
    // webContents already destroyed
  }
}

export { registerModelsAuthHandlers };
