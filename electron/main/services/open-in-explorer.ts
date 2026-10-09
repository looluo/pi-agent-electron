/**
 * Port of app/api/open-in-explorer (GET availability, POST reveal): the web
 * form factor had to ask the server whether it runs on the user's machine;
 * the desktop app always does, so availability is constant and the reveal is
 * a shell open.
 */
import { shell } from "electron";

/** GET /api/open-in-explorer — availability and the platform's manager name. */
export function openInExplorerAvailable(): { supported: boolean; reason: string | null; platform: string } {
  return { supported: true, reason: null, platform: process.platform };
}

/** POST /api/open-in-explorer — reveal a folder in the system file manager. */
export async function openInExplorer(cwd: string): Promise<{ ok: boolean; status: number; error?: string }> {
  if (typeof cwd !== "string" || !cwd.trim()) {
    return { ok: false, status: 400, error: "cwd must be a non-empty path" };
  }
  const errorMessage = await shell.openPath(cwd);
  if (errorMessage) return { ok: false, status: 500, error: errorMessage };
  return { ok: true, status: 200 };
}
