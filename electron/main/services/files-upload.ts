import fs from "fs";
import { getAllowedFileRoots } from "@/lib/file-access";
import {
  inspectUploadTargets,
  parseUploadConflictStrategy,
  prepareUploadDestination,
  replaceUploadFile,
  validateUploadPaths,
} from "@/lib/file-upload";
import {
  createDirectory,
  deleteEntry,
  FileManageError,
  moveEntry,
  resolveManagedDirectory,
} from "@/lib/file-manage";
import { errorMessage } from "@/lib/errors";

/**
 * Port of app/api/files/[...path] (POST): folder/file uploads (including
 * nested subfolders) and file-tree management (`mkdir`, `move`, `delete`).
 * The HTTP multipart body is replaced by an IPC payload of typed byte arrays;
 * size limits and security checks are enforced identically.
 */

// One limit for a request's files together; a single file may use all of it.
const MAX_UPLOAD_TOTAL_BYTES = 100 * 1024 * 1024;

async function getUploadDirectory(directory: string): Promise<
  { directory: string } | { error: string; status: number }
> {
  try {
    return { directory: resolveManagedDirectory(directory, await getAllowedFileRoots()) };
  } catch (error) {
    if (error instanceof FileManageError) {
      return { error: error.message, status: error.status };
    }
    throw error;
  }
}

export async function filesManage(
  target: string,
  type: string,
  rawBody: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = rawBody && typeof rawBody === "object"
    ? rawBody as { name?: unknown; destination?: unknown }
    : null;
  const roots = await getAllowedFileRoots();
  try {
    if (type === "mkdir") {
      return { status: 200, body: { path: await createDirectory(target, body?.name, roots) } };
    }
    if (type === "move") {
      if (typeof body?.destination !== "string" || !body.destination) {
        return { status: 400, body: { error: "destination must be a folder path" } };
      }
      return { status: 200, body: { path: await moveEntry(target, body.destination, body.name, roots) } };
    }
    if (type === "delete") {
      await deleteEntry(target, roots);
      return { status: 200, body: { ok: true } };
    }
    return { status: 400, body: { error: "Invalid file manage request type" } };
  } catch (error) {
    if (error instanceof FileManageError) {
      return { status: error.status, body: { error: error.message } };
    }
    return { status: 500, body: { error: errorMessage(error) } };
  }
}

export async function filesUploadCheck(
  directory: string,
  paths: string[],
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!Array.isArray(paths) || !paths.every((item) => typeof item === "string")) {
    return { status: 400, body: { error: "paths must be an array of strings" } };
  }
  const target = await getUploadDirectory(directory);
  if ("error" in target) return { status: target.status, body: { error: target.error } };
  const validationError = validateUploadPaths(paths);
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }
  return { status: 200, body: inspectUploadTargets(target.directory, paths) as unknown as Record<string, unknown> };
}

export type IpcUploadFile = { name: string; path?: string; bytes: Uint8Array };

export async function filesUpload(
  directory: string,
  files: IpcUploadFile[],
  conflict: string | null,
  onProgress?: (done: number, total: number, fileName: string) => void,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const strategy = parseUploadConflictStrategy(conflict);
  if (!strategy) {
    return { status: 400, body: { error: "Invalid conflict strategy" } };
  }
  if (files.reduce((total, file) => total + file.bytes.byteLength, 0) > MAX_UPLOAD_TOTAL_BYTES) {
    return { status: 413, body: { error: "Uploads must total 100MB or less" } };
  }
  const uploadPaths = files.map((file) => file.path ?? file.name);
  const validationError = validateUploadPaths(uploadPaths);
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  const target = await getUploadDirectory(directory);
  if ("error" in target) return { status: target.status, body: { error: target.error } };
  const uploadDir = target.directory;

  const inspection = inspectUploadTargets(uploadDir, uploadPaths);
  if (strategy === "error" && inspection.conflicts.length > 0) {
    return {
      status: 409,
      body: {
        error: "One or more files already exist",
        conflicts: inspection.conflicts,
        nonReplaceable: inspection.nonReplaceable,
      },
    };
  }

  const conflictSet = new Set(inspection.conflicts);
  const nonReplaceableSet = new Set(inspection.nonReplaceable);
  const uploaded: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  let done = 0;
  for (const [index, file] of files.entries()) {
    const uploadPath = uploadPaths[index];
    if (conflictSet.has(uploadPath) && strategy === "skip") {
      skipped.push(uploadPath);
      done += 1;
      onProgress?.(done, files.length, uploadPath);
      continue;
    }
    if (conflictSet.has(uploadPath) && nonReplaceableSet.has(uploadPath)) {
      errors.push({ name: uploadPath, error: "Cannot replace a directory or symbolic link" });
      done += 1;
      onProgress?.(done, files.length, uploadPath);
      continue;
    }

    try {
      const destination = prepareUploadDestination(uploadDir, uploadPath);
      if (conflictSet.has(uploadPath)) {
        // Keep the old entry intact until its complete replacement can be renamed over it
        // (a failed write must not lose the previous file).
        await replaceUploadFile(destination, Buffer.from(file.bytes));
      } else {
        // `wx` refuses whatever appeared there since, a link included.
        await fs.promises.writeFile(destination, file.bytes, { flag: "wx" });
      }
      uploaded.push(uploadPath);
    } catch (error) {
      const exists = (error as NodeJS.ErrnoException).code === "EEXIST";
      errors.push({ name: uploadPath, error: exists ? "Already exists" : errorMessage(error) });
    }
    done += 1;
    onProgress?.(done, files.length, uploadPath);
  }

  return { status: errors.length > 0 ? 207 : 200, body: { uploaded, skipped, errors } };
}
