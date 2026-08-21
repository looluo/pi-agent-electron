/**
 * Ambient typing for the preload bridge (electron/preload/index.ts).
 * The structural type lives in lib/pi-ipc.ts; this only attaches it to Window.
 */
import type { PiBridge } from "@/lib/pi-ipc";

declare global {
  interface Window {
    pi: PiBridge;
  }
}

export {};
