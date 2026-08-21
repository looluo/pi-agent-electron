import fs from "fs";
import path from "path";
import {
  getAllowedFileRoots,
  isFilePathAllowed,
} from "@/lib/file-access";
import {
  inspectUploadTargets,
  parseUploadConflictStrategy,
  validateUploadFileNames,
} from "@/lib/file-upload";

/**
 * Port of app/api/files/[...path] (POST). The HTTP multipart body is replaced
 * by an IPC payload of typed byte arrays; size limits are enforced identically.
 */

const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_TOTAL_BYTES = 100 * 1024 * 1024;

async function getUploadDirectory(directory: string): Promise<
  { directory: string } | { error: string; status: number }
> {
  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(directory, allowedRoots)) {
    return { error: "Access denied", status: 403 };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(directory);
  } catch {
    return { error: "Upload directory not found", status: 404 };
  }
  if (!stat.isDirectory()) {
    return { error: "Upload target is not a directory", status: 400 };
  }

  // A browsable directory can be a symlink. Resolve both sides before writes
  // so a symlink inside an allowed root cannot redirect uploads outside it.
  const realDirectory = fs.realpathSync(directory);
  const realRoots = new Set<string>();
  for (const root of allowedRoots) {
    try {
      realRoots.add(fs.realpathSync(root));
    } catch {
      // Ignore stale session roots that no longer exist.
    }
  }
  if (!isFilePathAllowed(realDirectory, realRoots)) {
    return { error: "Access denied", status: 403 };
  }

  return { directory: realDirectory };
}

export async function filesUploadCheck(
  directory: string,
  fileNames: string[],
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!Array.isArray(fileNames) || !fileNames.every((item) => typeof item === "string")) {
    return { status: 400, body: { error: "fileNames must be an array of strings" } };
  }
  const target = await getUploadDirectory(directory);
  if ("error" in target) return { status: target.status, body: { error: target.error } };
  const validationError = validateUploadFileNames(fileNames);
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }
  return { status: 200, body: inspectUploadTargets(target.directory, fileNames) as unknown as Record<string, unknown> };
}

export type IpcUploadFile = { name: string; bytes: Uint8Array };

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
  if (files.some((file) => file.bytes.byteLength > MAX_UPLOAD_FILE_BYTES)) {
    return { status: 413, body: { error: "Each upload must be 25MB or smaller" } };
  }
  if (files.reduce((total, file) => total + file.bytes.byteLength, 0) > MAX_UPLOAD_TOTAL_BYTES) {
    return { status: 413, body: { error: "Uploads must total 100MB or less" } };
  }
  const fileNames = files.map((file) => file.name);
  const validationError = validateUploadFileNames(fileNames);
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  const target = await getUploadDirectory(directory);
  if ("error" in target) return { status: target.status, body: { error: target.error } };
  const uploadDir = target.directory;

  const inspection = inspectUploadTargets(uploadDir, fileNames);
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
  for (const file of files) {
    const destination = path.join(uploadDir, file.name);
    if (conflictSet.has(file.name) && strategy === "skip") {
      skipped.push(file.name);
      done += 1;
      onProgress?.(done, files.length, file.name);
      continue;
    }
    if (conflictSet.has(file.name) && nonReplaceableSet.has(file.name)) {
      errors.push({ name: file.name, error: "Cannot replace a directory or symbolic link" });
      done += 1;
      onProgress?.(done, files.length, file.name);
      continue;
    }

    try {
      if (conflictSet.has(file.name)) {
        fs.unlinkSync(destination);
      }
      fs.writeFileSync(destination, file.bytes, { flag: "wx" });
      uploaded.push(file.name);
    } catch (error) {
      errors.push({ name: file.name, error: error instanceof Error ? error.message : String(error) });
    }
    done += 1;
    onProgress?.(done, files.length, file.name);
  }

  return { status: errors.length > 0 ? 207 : 200, body: { uploaded, skipped, errors } };
}
