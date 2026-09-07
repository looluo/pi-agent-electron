import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import {
  createTerminal as createManagedTerminal,
  killTerminal,
  resizeTerminal,
  subscribeTerminal,
  writeTerminal,
  type TerminalEvent,
} from "@/lib/terminal-manager";

/**
 * Port of upstream app/api/terminal/* (9290c27 + ce18006).
 *
 * The HTTP + SSE routes are dropped per ADR-0003/0004: the node-pty manager
 * runs in the Electron main process (it lives in pi-web/src/lib like
 * rpc-manager), and the renderer talks over typed IPC channels with a
 * per-subscription push channel mirroring the file-watch protocol.
 */

export type TerminalFrame =
  | { event: "output"; data: { data: string; offset: number; reset?: boolean } }
  | { event: "exit"; data: { exitCode: number } }
  | { event: "closed"; data: Record<string, never> };

export function frameOf(event: TerminalEvent): TerminalFrame {
  switch (event.type) {
    case "output":
      return { event: "output", data: { data: event.data, offset: event.offset, ...(event.reset ? { reset: true } : {}) } };
    case "exit":
      return { event: "exit", data: { exitCode: event.exitCode } };
    case "closed":
      return { event: "closed", data: {} };
  }
}

/** Port of POST /api/terminal — create (or reuse) a workspace PTY. The id is
 *  client-generated (terminal-tab-state) so restored tabs address the same PTY. */
export async function terminalCreate(
  cwd: string,
  cols: number,
  rows: number,
  id?: string,
): Promise<{ status: number; body: { id?: string; error?: string } }> {
  try {
    if (typeof cwd !== "string" || !cwd) return { status: 400, body: { error: "cwd required" } };
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }
    const created = createManagedTerminal(cwd, cols, rows, typeof id === "string" && id ? id : undefined);
    return { status: 200, body: { id: created } };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/** Port of GET /api/terminal/[id]/events — replay + live push lease.
 *  Returns the response plus the lease-release handle. */
export function terminalSubscribe(
  id: string,
  push: (event: TerminalEvent) => void,
  after?: number,
): { status: number; body: { replay?: unknown; exited?: boolean; exitCode?: number | null; error?: string }; unsubscribe?: () => void } {
  const handle = subscribeTerminal(id, push, after);
  if (!handle) return { status: 404, body: { error: "Terminal not found" } };
  return {
    status: 200,
    body: { replay: handle.output, exited: handle.exited, exitCode: handle.exitCode },
    unsubscribe: handle.unsubscribe,
  };
}

export function terminalWrite(id: string, data: string): boolean {
  return writeTerminal(id, data);
}

export function terminalResize(id: string, cols: number, rows: number): boolean {
  return resizeTerminal(id, cols, rows);
}

/** Port of DELETE /api/terminal/[id]. */
export function terminalKill(id: string): boolean {
  return killTerminal(id);
}
