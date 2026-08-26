import { protocol } from "electron";
import { handleFilesGet, filePathFromSegments } from "./services/files";
import { sessionToolResultImage } from "./services/sessions";

/**
 * In-process `pifile://` protocol: serves file reads/previews/media for the
 * renderer without opening any port (ADR-0003). URL shape mirrors the retired
 * route: pifile://local/<encoded segments>?type=...&sessionId=...
 *
 * registerSchemesAsPrivileged must run before app ready (called from
 * registerEarlySchemes).
 */
export function registerEarlySchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "pifile",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

export function registerFilesProtocol(): void {
  protocol.handle("pifile", (request) => {
    const url = new URL(request.url);
    // pifile://session/<sessionId>/entries/<entryId>/tool-result-image — lazy
    // historical tool-result images (upstream 70c871b), served from the session
    // file instead of an HTTP route.
    if (url.host === "session") {
      return handleSessionEntryGet(url);
    }
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const filePath = filePathFromSegments(segments);
    const type = url.searchParams.get("type") ?? "list";
    const sessionId = url.searchParams.get("sessionId");
    const range = request.headers.get("range");
    return handleFilesGet(filePath, type, sessionId, range);
  });
}

async function handleSessionEntryGet(url: URL): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  const [sessionId, entriesLiteral, entryId, action] = segments;
  const blockIndexParam = url.searchParams.get("blockIndex");
  const blockIndex = blockIndexParam === null ? Number.NaN : Number(blockIndexParam);

  if (entriesLiteral !== "entries" || action !== "tool-result-image") {
    return jsonError("Unknown session resource", 404);
  }

  const result = await sessionToolResultImage(sessionId ?? "", entryId ?? "", blockIndex);
  if ("error" in result) {
    return jsonError(result.error, result.status);
  }

  const body = new ArrayBuffer(result.bytes.byteLength);
  new Uint8Array(body).set(result.bytes);
  return new Response(body, {
    headers: {
      "Content-Type": result.mime,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
