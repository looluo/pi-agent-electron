/**
 * Port of app/api/open-in-explorer (GET availability, POST open/reveal): the
 * desktop app always runs on the user's machine, so availability is constant.
 * `{ cwd }` (or bare string) opens a folder with `shell.openPath`; `{ reveal }`
 * shows a file or folder selected in its parent with `shell.showItemInFolder`.
 */
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { shell } from "electron";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { errorMessage } from "@/lib/errors";

/** GET /api/open-in-explorer — availability and the platform's manager name. */
export function openInExplorerAvailable(): { supported: boolean; reason: string | null; platform: string } {
  return { supported: true, reason: null, platform: process.platform };
}

/** POST /api/open-in-explorer — open a folder or reveal an entry in the OS file manager. */
export async function openInExplorer(
  request: string | { cwd?: unknown; reveal?: unknown },
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const isString = typeof request === "string";
    const reveal = !isString && typeof request?.reveal === "string" && request.reveal.trim() !== "";
    const requested = isString ? request : (reveal ? request.reveal : request?.cwd);
    if (typeof requested !== "string" || !requested.trim()) {
      return { ok: false, status: 400, error: "cwd-required" };
    }
    const target = resolve(requested);
    const roots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(target, roots)) {
      return { ok: false, status: 403, error: "access-denied" };
    }
    const isDirectory = (await stat(target)).isDirectory();
    if (!reveal && !isDirectory) {
      return { ok: false, status: 400, error: "not-a-directory" };
    }
    if (reveal) {
      shell.showItemInFolder(target);
      return { ok: true, status: 200 };
    }
    const openError = await shell.openPath(target);
    if (openError) return { ok: false, status: 500, error: openError };
    return { ok: true, status: 200 };
  } catch (error) {
    return { ok: false, status: 500, error: errorMessage(error) };
  }
}
