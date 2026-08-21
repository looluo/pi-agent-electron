import type { PiBridge } from "@/lib/pi-ipc";

// Ambient Window.pi typing for renderer AND e2e (page.evaluate) contexts.
declare global {
  interface Window {
    pi: PiBridge;
  }
}

export { PiBridge };
