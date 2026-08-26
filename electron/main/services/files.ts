import fs from "fs";
import path from "path";
import {
  getAllowedFileRoots,
  isExistingFilePathAllowed,
  isFilePathAllowed,
  isWindowsAbsolutePath,
  normalizeSlashes,
} from "@/lib/file-access";
import {
  DOCX_PREVIEW_MAX_BYTES,
  IMAGE_PREVIEW_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  documentPreviewKind,
  getAudioMime,
  getDocumentMime,
  getFileExt,
  getImageMime,
} from "@/lib/file-types";
import { resolveDirentIsDirectory } from "@/lib/file-dirent";
import { isFilePathReferencedBySession } from "@/lib/session-file-references";
import { samePath } from "@/lib/paths";

/**
 * Port of app/api/files/[...path] (GET) serving through the in-process
 * `pifile://` protocol (spec ADR-0003: no listening port). The route body is
 * preserved verbatim; the protocol handler and the watch channel call into it.
 */

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor", ".DS_Store", ".git",
]);

const IGNORED_SUFFIXES = [".pyc"];

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", rb: "ruby",
  go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
  html: "html", htm: "html", css: "css", scss: "css", less: "css",
  json: "json", jsonl: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", xml: "xml", md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  sql: "sql", graphql: "graphql", gql: "graphql",
  dockerfile: "dockerfile", tf: "hcl", hcl: "hcl",
  env: "bash", gitignore: "bash", txt: "text",
  pdf: "pdf", docx: "word",
};

function getLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  if (base === ".env" || base.startsWith(".env.")) return "bash";
  if (base === "makefile" || base === "gnumakefile") return "makefile";
  const ext = base.split(".").pop() ?? "";
  return EXT_TO_LANGUAGE[ext] ?? "text";
}

export function filePathFromSegments(segments: string[]): string {
  const joined = segments.join("/");
  const slashJoined = normalizeSlashes(joined);
  if (isWindowsAbsolutePath(slashJoined)) return slashJoined;
  return "/" + joined.replace(/^\/+/, "");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function createFileBodyStream(filePath: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const fileStream = fs.createReadStream(filePath, range);
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on("data", (chunk: Buffer) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          closed = true;
          fileStream.destroy();
        }
      });
      fileStream.once("end", () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* client abandoned the stream */ }
      });
      fileStream.once("error", (error) => {
        if (closed) return;
        closed = true;
        try { controller.error(error); } catch { /* response already abandoned */ }
      });
    },
    cancel() {
      closed = true;
      fileStream.destroy();
    },
  });
}

function encodeHeaderValue(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function getContentDisposition(filePath: string, asDownload = false): string {
  const disposition = asDownload ? "attachment" : "inline";
  const fileName = path.basename(filePath);
  const fallback = fileName.replace(/[^\x20-\x7E]|["\\;\r\n]/g, "_") || "download";
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeHeaderValue(fileName)}`;
}

function streamFile(filePath: string, stat: fs.Stats, contentType: string, rangeHeader: string | null, asDownload = false): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes",
    "Content-Disposition": getContentDisposition(filePath, asDownload),
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  };
  // SVG is the only preview type a browser executes as a document. A
  // repo-controlled SVG navigated to directly (for example through a link in
  // a transcript) would otherwise run script in the renderer origin, where it
  // can call any window.pi bridge method. These headers only affect document
  // rendering; <img> preview embedding ignores them.
  if (contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
    headers["Referrer-Policy"] = "no-referrer";
  }

  if (!rangeHeader) {
    return new Response(createFileBodyStream(filePath), {
      headers: { ...headers, "Content-Length": String(stat.size) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}` } });
  }

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(stat.size - suffixLength, 0);
    end = stat.size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= stat.size) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}` } });
  }

  end = Math.min(end, stat.size - 1);
  const chunkSize = end - start + 1;
  return new Response(createFileBodyStream(filePath, { start, end }), {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapDocxPreviewHtml(bodyHtml: string, fileName: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; min-height: 100%; background: #eef1f5; color: #171717; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 28px; }
  main {
    box-sizing: border-box;
    max-width: 840px;
    min-height: calc(100vh - 56px);
    margin: 0 auto;
    padding: 56px 64px;
    background: #fff;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
  }
  .file-title {
    margin: 0 0 28px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e5e7eb;
    color: #6b7280;
    font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-word;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.1em 0 0.45em; color: #111827; }
  p { margin: 0.65em 0; line-height: 1.7; }
  table { border-collapse: collapse; max-width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d1d5db; padding: 6px 9px; vertical-align: top; }
  img { max-width: 100%; height: auto; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  a { color: #2563eb; }
  @media (max-width: 720px) {
    body { padding: 0; background: #fff; }
    main { min-height: 100vh; padding: 28px 22px; box-shadow: none; }
  }
</style>
</head>
<body>
<main>
<div class="file-title">${escapeHtml(fileName)}</div>
${bodyHtml}
</main>
</body>
</html>`;
}

/** GET core, shared by the pifile protocol handler. Mirrors the route. */
export async function handleFilesGet(
  filePath: string,
  rawType: string,
  sessionId: string | null,
  rangeHeader: string | null,
): Promise<Response> {
  try {
    const type = rawType || "list";
    if (!["list", "read", "download", "meta", "preview", "watch"].includes(type)) {
      return json({ error: "Invalid file request type" }, 400);
    }

    const allowedRoots = await getAllowedFileRoots();
    const allowedByRoot = isFilePathAllowed(filePath, allowedRoots);
    const allowedBySessionReference =
      !allowedByRoot &&
      type !== "list" &&
      await isFilePathReferencedBySession(filePath, sessionId);
    if (!allowedByRoot && !allowedBySessionReference) {
      return json({ error: "Access denied" }, 403);
    }

    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(filePath);
    } catch {
      if (type !== "watch") {
        return json({ error: "Not found" }, 404);
      }
    }

    const existingAuthorizationPath = stat ? filePath : path.dirname(filePath);
    if (
      !allowedBySessionReference
      && !isExistingFilePathAllowed(existingAuthorizationPath, allowedRoots)
    ) {
      return json({ error: "Access denied" }, 403);
    }

    if (type === "read") {
      if (!stat?.isFile()) return json({ error: "Not a file" }, 400);
      const imageMime = getImageMime(filePath);
      if (imageMime) {
        if (stat.size > IMAGE_PREVIEW_MAX_BYTES) {
          return json({ error: "Image too large (>10MB)" }, 413);
        }
        return streamFile(filePath, stat, imageMime, rangeHeader);
      }
      const audioMime = getAudioMime(filePath);
      if (audioMime) {
        return streamFile(filePath, stat, audioMime, rangeHeader);
      }
      const documentMime = getDocumentMime(filePath);
      if (documentMime) {
        return streamFile(filePath, stat, documentMime, rangeHeader);
      }
      if (stat.size > TEXT_PREVIEW_MAX_BYTES) {
        return json({ error: "File too large for preview (>256KB)" }, 413);
      }
      const content = fs.readFileSync(filePath, "utf-8");
      const language = getLanguage(filePath);
      return json({ content, language, size: stat.size });
    }

    if (type === "download") {
      if (!stat?.isFile()) return json({ error: "Not a file" }, 400);
      const mime = getImageMime(filePath) || getAudioMime(filePath) || getDocumentMime(filePath) || "application/octet-stream";
      return streamFile(filePath, stat, mime, rangeHeader, true);
    }

    if (type === "meta") {
      if (!stat?.isFile()) return json({ error: "Not a file" }, 400);
      const imageMime = getImageMime(filePath);
      const audioMime = getAudioMime(filePath);
      const documentMime = getDocumentMime(filePath);
      return json({
        size: stat.size,
        language: getLanguage(filePath),
        mime: imageMime || audioMime || documentMime || "text/plain",
        previewKind: documentPreviewKind(filePath),
      });
    }

    if (type === "preview") {
      if (!stat?.isFile()) return json({ error: "Not a file" }, 400);
      if (getFileExt(filePath) !== "docx") {
        return json({ error: "Preview not available for this file type" }, 400);
      }
      if (stat.size > DOCX_PREVIEW_MAX_BYTES) {
        return json({ error: "DOCX too large for preview (>10MB)" }, 413);
      }

      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml(
        { path: filePath },
        {
          externalFileAccess: false,
          convertImage: mammoth.images.dataUri,
        }
      );
      const html = wrapDocxPreviewHtml(result.value, path.basename(filePath));
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors *",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // type === "list"
    if (!stat?.isDirectory()) {
      return json({ error: "Not a directory" }, 400);
    }

    const dirents = fs.readdirSync(filePath, { withFileTypes: true });
    const entries = dirents
      .filter((d) => !IGNORED_NAMES.has(d.name) && !IGNORED_SUFFIXES.some((s) => d.name.endsWith(s)))
      .flatMap((d) => {
        const isDir = resolveDirentIsDirectory(d, path.join(filePath, d.name));
        return isDir === null ? [] : [{ name: d.name, isDir, size: 0, modified: "" }];
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return json({ entries, path: filePath });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
}

/** Port of the watch branch: returns a disposer. Frames match SSE events. */
export function openFileWatch(
  filePath: string,
  onEvent: (eventName: string, data: Record<string, unknown>) => void,
  onClosed: () => void,
): () => void {
  let stat: fs.Stats | undefined;
  try {
    stat = fs.statSync(filePath);
  } catch {
    // watched-before-exists is allowed
  }
  if (stat && !stat.isFile()) {
    onEvent("error", { message: "Not a file" });
    onClosed();
    return () => {};
  }

  let watcher: fs.FSWatcher | null = null;
  let lastMtimeMs = stat?.mtimeMs ?? 0;
  let lastCtimeMs = stat?.ctimeMs ?? 0;
  let lastIno = stat?.ino ?? 0;
  let lastSize = stat?.size ?? 0;
  let lastExists = stat !== undefined;

  const watchedDirectory = path.dirname(filePath);
  try {
    watcher = fs.watch(watchedDirectory, (_eventType, changedName) => {
      if (
        changedName != null
        && !samePath(path.join(watchedDirectory, changedName.toString()), filePath)
      ) return;
      try {
        const s = fs.statSync(filePath);
        if (
          lastExists
          && s.mtimeMs === lastMtimeMs
          && s.ctimeMs === lastCtimeMs
          && s.ino === lastIno
          && s.size === lastSize
        ) return;
        lastExists = true;
        lastMtimeMs = s.mtimeMs;
        lastCtimeMs = s.ctimeMs;
        lastIno = s.ino;
        lastSize = s.size;
        onEvent("change", { mtime: s.mtime.toISOString(), size: s.size });
      } catch {
        if (!lastExists) return;
        lastExists = false;
        onEvent("change", { mtime: new Date().toISOString(), size: 0 });
      }
    });
    watcher.on("error", () => {
      close();
    });
    // The client snapshots only after this event, so emit it after the
    // watcher exists to avoid dropping changes between those steps.
    onEvent("connected", { filePath });
  } catch {
    onEvent("error", { message: "Failed to watch file" });
    onClosed();
    return () => {};
  }

  function close() {
    try { watcher?.close(); } catch { /* ignore */ }
    watcher = null;
    onClosed();
  }

  return () => {
    try { watcher?.close(); } catch { /* ignore */ }
    watcher = null;
  };
}
