import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { registerModelsAuthHandlers } from "./ipc-models-auth";
import { registerEarlySchemes, registerFilesProtocol } from "./files-protocol";

registerEarlySchemes();

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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
