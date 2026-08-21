import { protocol } from "electron";
import { handleFilesGet, filePathFromSegments } from "./services/files";

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
