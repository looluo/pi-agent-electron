import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { isAbsolute, resolve } from "path";
import { stat as statAsync } from "fs/promises";
import { statSync, mkdirSync, type Stats } from "fs";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  allowFileRoot,
  getAllowedFileRoots,
  isExistingFilePathAllowed,
  isFilePathAllowed,
  isWindowsAbsolutePath,
} from "@/lib/file-access";
import { projectIdentityKey } from "@/lib/project-identity";
import { resolveProject, addWorktree, findCurrentWorktreePath, listWorktrees, removeWorktree } from "@/lib/worktree";
import {
  getBrowseStartDirectory,
  getParentDirectory,
  listDirectories,
  listWindowsDrives,
  resolveDirectory,
  shouldShowWindowsDrivePicker,
} from "@/lib/directory-browser";
import { getProjectTrustStatus, trustProject } from "@/lib/project-trust";
import { destroyRpcSessionsForCwd, hasBusyRpcSessionForCwd } from "@/lib/rpc-manager";
import { invalidateModelsCache } from "@/lib/models-cache";
import { getGitStatus, getGitFileDiff } from "@/lib/git-changes";
import { buildEntriesFromFiles, filterFileEntries, type FileIndexEntry } from "@/lib/file-fuzzy";

/**
 * Ports of app/api/{cwd/validate, cwd/browse, default-cwd, home,
 * project-trust, worktrees, git/status, git/diff, file-index}.
 */

const execFileAsync = promisify(execFile);

function normalizeCwd(cwd: string): string {
  if (cwd === "~") return homedir();
  if (cwd.startsWith("~/")) return resolve(homedir(), cwd.slice(2));
  return isAbsolute(cwd) ? cwd : resolve(cwd);
}

/** POST /api/cwd/validate */
export async function cwdValidate(cwd: string) {
  const trimmed = typeof cwd === "string" ? cwd.trim() : "";
  if (!trimmed) return { status: 400, body: { error: "Path is required" } };

  const normalizedCwd = normalizeCwd(trimmed);
  let stat: Stats;
  try {
    stat = statSync(normalizedCwd);
  } catch {
    return { status: 400, body: { error: `Directory does not exist: ${cwd}` } };
  }
  if (!stat.isDirectory()) {
    return { status: 400, body: { error: `Path is not a directory: ${cwd}` } };
  }

  allowFileRoot(normalizedCwd);
  const project = await resolveProject(normalizedCwd);
  return {
    status: 200,
    body: {
      success: true,
      cwd: normalizedCwd,
      projectRoot: project.projectRoot,
      projectKey: projectIdentityKey(project.projectRoot),
    },
  };
}

/** GET /api/cwd/browse */
export async function cwdBrowse(requested: string | undefined) {
  const trimmed = requested?.trim();
  if (shouldShowWindowsDrivePicker(trimmed)) {
    return {
      path: "",
      parentPath: null,
      drives: await listWindowsDrives(),
      directories: [],
    };
  }

  const candidate = getBrowseStartDirectory(trimmed);
  let resolved: string;
  try {
    resolved = await resolveDirectory(candidate);
  } catch {
    return { notFound: true as const };
  }

  const directoryStat = await statAsync(resolved);
  if (!directoryStat.isDirectory()) {
    return { badRequest: true as const };
  }

  const directories = await listDirectories(resolved);
  return { path: resolved, parentPath: getParentDirectory(resolved), directories };
}

/** POST /api/default-cwd */
export function defaultCwd() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dir = path.join(homedir(), `pi-cwd-${date}`);
  mkdirSync(dir, { recursive: true });
  allowFileRoot(dir);
  return { cwd: dir };
}

/** GET /api/home */
export function home() {
  return { home: homedir() };
}

async function validateTrustedCwd(value: unknown): Promise<{ cwd: string } | { error: string; status: number }> {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "cwd required", status: 400 };
  }
  const cwd = resolve(value);
  try {
    if (!(await statAsync(cwd)).isDirectory()) {
      return { error: "cwd must be a directory", status: 400 };
    }
  } catch {
    return { error: "Directory does not exist", status: 400 };
  }
  const allowedRoots = await getAllowedFileRoots();
  if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
    return { error: "Access denied", status: 403 };
  }
  return { cwd };
}

/** GET /api/project-trust?cwd= */
export async function projectTrustGet(cwd: string | null) {
  const result = await validateTrustedCwd(cwd);
  if ("error" in result) return { status: result.status, body: { error: result.error } };
  return { status: 200, body: getProjectTrustStatus(result.cwd, getAgentDir()) as unknown as Record<string, unknown> };
}

/** POST /api/project-trust { cwd } */
export async function projectTrustPost(cwd: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const result = await validateTrustedCwd(cwd);
  if ("error" in result) return { status: result.status, body: { error: result.error } };

  const agentDir = getAgentDir();
  const current = getProjectTrustStatus(result.cwd, agentDir);
  if (!current.requiresTrust) {
    return { status: 409, body: { error: "This project has no resources that require trust" } };
  }
  if (hasBusyRpcSessionForCwd(result.cwd)) {
    return { status: 409, body: { error: "Wait for the active session to finish before trusting this project" } };
  }

  const status = trustProject(result.cwd, agentDir);
  destroyRpcSessionsForCwd(result.cwd);
  invalidateModelsCache();
  return { status: 200, body: status as unknown as Record<string, unknown> };
}

/** Same gate as /api/files (spec: single security boundary). */
async function checkCwdAllowed(cwd: string): Promise<{ error: string; status: number } | null> {
  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(cwd, allowedRoots) || !isExistingFilePathAllowed(cwd, allowedRoots)) {
    return { error: "Access denied", status: 403 };
  }
  return null;
}

/** GET /api/worktrees?cwd= */
export async function worktreesGet(cwd: string | null) {
  if (!cwd) return { status: 400, body: { error: "cwd is required" } };
  const denied = await checkCwdAllowed(cwd);
  if (denied) return { status: denied.status, body: { error: denied.error } };

  const project = await resolveProject(cwd);
  let worktrees: Awaited<ReturnType<typeof listWorktrees>> = [];
  let currentWorktreePath: string | null = null;
  let isGit = true;
  try {
    worktrees = await listWorktrees(fs.existsSync(cwd) ? cwd : project.projectRoot);
    currentWorktreePath = findCurrentWorktreePath(worktrees, cwd);
  } catch {
    isGit = false;
  }
  for (const w of worktrees) allowFileRoot(w.path);
  return {
    status: 200,
    body: {
      projectRoot: project.projectRoot,
      projectKey: projectIdentityKey(project.projectRoot),
      isGit,
      isTopLevel: project.isTopLevel,
      currentWorktreePath,
      worktrees,
    },
  };
}

/** POST /api/worktrees { cwd, branch } */
export async function worktreesPost(body: { cwd?: string; branch?: string }) {
  if (!body.cwd || typeof body.cwd !== "string") return { status: 400, body: { error: "cwd is required" } };
  if (!body.branch || typeof body.branch !== "string") return { status: 400, body: { error: "branch is required" } };
  const denied = await checkCwdAllowed(body.cwd);
  if (denied) return { status: denied.status, body: { error: denied.error } };
  if (!fs.existsSync(body.cwd)) {
    return { status: 400, body: { error: `Directory does not exist: ${body.cwd}` } };
  }
  try {
    const result = await addWorktree(body.cwd, body.branch);
    return { status: 200, body: result as unknown as Record<string, unknown> };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

/** DELETE /api/worktrees { cwd, path, force? } */
export async function worktreesDelete(body: { cwd?: string; path?: string; force?: boolean }) {
  if (!body.cwd || typeof body.cwd !== "string") return { status: 400, body: { error: "cwd is required" } };
  if (!body.path || typeof body.path !== "string") return { status: 400, body: { error: "path is required" } };
  const denied = await checkCwdAllowed(body.cwd);
  if (denied) return { status: denied.status, body: { error: denied.error } };
  try {
    await removeWorktree(body.cwd, body.path, body.force === true);
    return { status: 200, body: { success: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dirty = /contains modified or untracked files|is dirty/i.test(message);
    return { status: dirty ? 409 : 400, body: { error: message, ...(dirty ? { dirty } : {}) } };
  }
}

/** GET /api/git/status?cwd= */
export async function gitStatus(cwd: string | null) {
  const trimmed = cwd?.trim() ?? "";
  if (!trimmed || (!trimmed.startsWith("/") && !isWindowsAbsolutePath(trimmed))) {
    return { status: 400, body: { error: "cwd must be an absolute path" } };
  }
  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(trimmed, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(trimmed);
  } catch {
    return { status: 404, body: { error: "Directory not found" } };
  }
  if (!stat.isDirectory()) {
    return { status: 400, body: { error: "Not a directory" } };
  }
  if (!isExistingFilePathAllowed(trimmed, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }
  return { status: 200, body: await getGitStatus(trimmed) as unknown as Record<string, unknown> };
}

/** GET /api/git/diff?cwd=&path= */
export async function gitDiff(cwd: string | null, filePath: string | null) {
  const trimmedCwd = cwd?.trim() ?? "";
  const trimmedPath = filePath?.trim() ?? "";
  if (!trimmedCwd || (!trimmedCwd.startsWith("/") && !isWindowsAbsolutePath(trimmedCwd))) {
    return { status: 400, body: { error: "cwd must be an absolute path" } };
  }
  if (!trimmedPath || (!trimmedPath.startsWith("/") && !isWindowsAbsolutePath(trimmedPath))) {
    return { status: 400, body: { error: "path must be an absolute path" } };
  }
  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(trimmedCwd, allowedRoots) || !isFilePathAllowed(trimmedPath, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }
  if (!isExistingFilePathAllowed(trimmedCwd, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }
  return { status: 200, body: await getGitFileDiff(trimmedCwd, trimmedPath) as unknown as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// file-index
// ---------------------------------------------------------------------------

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor", ".DS_Store",
]);
const IGNORED_SUFFIXES = [".pyc"];
const MAX_FILES = 5000;
const GIT_HARD_CAP = 200_000;
const WALK_HARD_CAP = 50_000;
const MAX_WALK_DEPTH = 8;
const MAX_QUERY_LENGTH = 500;
const CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 20;

interface FileListing {
  files: string[];
  hardTruncated: boolean;
}

interface CacheEntry {
  listing: FileListing;
  entries?: FileIndexEntry[];
  expiresAt: number;
}

declare global {
  var __piFileIndexCache: Map<string, CacheEntry> | undefined;
}

function getIndexCache(): Map<string, CacheEntry> {
  if (!globalThis.__piFileIndexCache) globalThis.__piFileIndexCache = new Map();
  return globalThis.__piFileIndexCache;
}

async function listWithGit(cwd: string): Promise<FileListing | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { timeout: 10_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } },
    );
    const all = stdout.split("\0").filter(Boolean);
    if (all.length > GIT_HARD_CAP) {
      return { files: all.slice(0, GIT_HARD_CAP), hardTruncated: true };
    }
    return { files: all, hardTruncated: false };
  } catch {
    return null;
  }
}

function listWithWalk(cwd: string): FileListing {
  const files: string[] = [];
  const queue: Array<{ abs: string; rel: string; depth: number }> = [{ abs: cwd, rel: "", depth: 0 }];
  while (queue.length > 0) {
    const { abs, rel, depth } = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (IGNORED_NAMES.has(d.name) || IGNORED_SUFFIXES.some((s) => d.name.endsWith(s))) continue;
      const childRel = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) {
        if (depth + 1 <= MAX_WALK_DEPTH) {
          queue.push({ abs: path.join(abs, d.name), rel: childRel, depth: depth + 1 });
        }
      } else if (d.isFile()) {
        if (files.length >= WALK_HARD_CAP) {
          return { files, hardTruncated: true };
        }
        files.push(childRel);
      }
    }
  }
  return { files, hardTruncated: false };
}

/** GET /api/file-index?cwd=&q= */
export async function fileIndex(cwd: string | null, query: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  const trimmedCwd = cwd?.trim() ?? "";
  if (!trimmedCwd || (!trimmedCwd.startsWith("/") && !isWindowsAbsolutePath(trimmedCwd))) {
    return { status: 400, body: { error: "cwd must be an absolute path" } };
  }
  const q = query?.slice(0, MAX_QUERY_LENGTH) ?? "";

  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(trimmedCwd, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(trimmedCwd);
  } catch {
    return { status: 404, body: { error: "Directory not found" } };
  }
  if (!stat.isDirectory()) {
    return { status: 400, body: { error: "Not a directory" } };
  }
  if (!isExistingFilePathAllowed(trimmedCwd, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }

  const cache = getIndexCache();
  const now = Date.now();
  let cached = cache.get(trimmedCwd);
  if (!cached || cached.expiresAt <= now) {
    const listing = (await listWithGit(trimmedCwd)) ?? listWithWalk(trimmedCwd);
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
    cached = { listing, expiresAt: now + CACHE_TTL_MS };
    cache.set(trimmedCwd, cached);
  }

  if (q) {
    cached.entries ??= buildEntriesFromFiles(cached.listing.files);
    return { status: 200, body: { matches: filterFileEntries(cached.entries, q) } };
  }

  const { files, hardTruncated } = cached.listing;
  return {
    status: 200,
    body: {
      files: files.slice(0, MAX_FILES),
      truncated: hardTruncated || files.length > MAX_FILES,
    },
  };
}
