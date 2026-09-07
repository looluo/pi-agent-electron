import { bridge } from "./pi-ipc";

/** Electron port of upstream lib/terminal-client.ts: the HTTP + SSE surface
 *  collapses onto typed IPC channels. Delivery is still ordered per call;
 *  input is never replayed after an error. */

export async function createWorkspaceTerminal(cwd: string, cols: number, rows: number, id: string): Promise<{ id: string }> {
  const result = await bridge().terminalCreate(cwd, cols, rows, id);
  if (result.status !== 200 || typeof result.body.id !== "string") {
    throw new Error((result.body as { error?: string }).error ?? `terminal create failed (${result.status})`);
  }
  return { id: result.body.id };
}

export function createTerminalWriter(id: string, onError: (error: Error) => void) {
  let stopped = false;
  const run = (call: () => Promise<boolean>, what: string) => {
    if (stopped) return;
    call().then((ok) => {
      // A dead id is not retryable; surface and stop like the HTTP client did.
      if (!ok && !stopped) {
        stopped = true;
        onError(new Error(`terminal ${what} failed`));
      }
    }).catch((error: Error) => {
      if (!stopped) {
        stopped = true;
        onError(error);
      }
    });
  };
  return {
    write(data: string) {
      if (stopped) return;
      run(() => bridge().terminalWrite(id, data), "write");
    },
    resize(cols: number, rows: number) {
      run(() => bridge().terminalResize(id, cols, rows), "resize");
    },
    stop() {
      stopped = true;
    },
  };
}

export function killTerminal(id: string): void {
  void bridge().terminalKill(id);
}
