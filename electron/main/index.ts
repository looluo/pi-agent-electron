import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { registerModelsAuthHandlers } from "./ipc-models-auth";
import { registerSkillsPluginsHandlers } from "./ipc-skills-plugins";
import { registerMcpHandlers } from "./ipc-mcp";
import { registerEarlySchemes, registerFilesProtocol } from "./files-protocol";
import { repairPathAtStartup } from "./services/shell-path";
import { configureHttpDispatcher, readHttpIdleTimeoutMs } from "@/lib/http-dispatcher";
import { applyCodemodeWorkerDefault } from "@/lib/codemode-workers";

registerEarlySchemes();

// Undici proxy/h2/timeout configuration (ported from Next instrumentation.ts).
// Apply the user's global settings.json httpIdleTimeoutMs the way the pi CLI
// does (upstream 650d7a3): without it the built-in five minutes aborts a
// provider stream that stays quiet for longer.
configureHttpDispatcher(readHttpIdleTimeoutMs());
// pi-web 0.13.0 (#837/#1444): raise pi's codemode worker limit before any
// agent starts; the SDK reads PI_CODEMODE_MAX_WORKERS per call.
applyCodemodeWorkerDefault();

// Finder/Dock launches inherit launchd's minimal PATH, which breaks child
// spawns like the plugin manager's `npm` ("spawn npm ENOENT"). Repair it
// before anything spawns: static tool dirs synchronously, login-shell
// capture in the background (nvm/volta/pnpm prefixes live in shell init).
repairPathAtStartup();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Pi Agent App",
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/preload.js", import.meta.url)),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Close = quit (ADR-0003): in-flight runs stop, sessions persist in jsonl.
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Links open in the system browser (upstream pi-web is a web app; here a
  // target="_blank" click would spawn a bare Electron window without our
  // preload). Desktop-app schemes (obsidian://, vscode://, …, upstream 5af2e04)
  // reach their registered handlers through the OS too. pifile:// and file://
  // are internal resources and never leave the app.
  const isInternalUrl = (url: string): boolean =>
    url.startsWith("file:")
    || url.startsWith("pifile://")
    || (process.env.ELECTRON_RENDERER_URL !== undefined && url.startsWith(process.env.ELECTRON_RENDERER_URL));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(
      fileURLToPath(new URL("../renderer/index.html", import.meta.url)),
    );
  }
}

app.whenReady().then(() => {
  registerFilesProtocol();
  registerIpcHandlers();
  registerModelsAuthHandlers();
  registerSkillsPluginsHandlers();
  registerMcpHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
