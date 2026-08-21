import { contextBridge, ipcRenderer } from "electron";
import type { PiApi } from "@shared/api";

declare global {
  interface Window {
    pi: PiApi;
  }
}

const api: PiApi = {
  ping: () => ipcRenderer.invoke("pi:ping"),
};

contextBridge.exposeInMainWorld("pi", api);
