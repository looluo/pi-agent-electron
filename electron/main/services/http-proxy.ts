import { existsSync } from "node:fs";
import type { HttpProxySettingsResponse } from "@/lib/api-types";
import { getGlobalSettingsPath, readGlobalSettings, updateGlobalSettings } from "@/lib/global-settings-file";
import { parseHttpProxy, resolveHttpProxies, setHttpProxy } from "@/lib/http-dispatcher";
import { errorMessage } from "@/lib/errors";

/**
 * Ports of GET/PUT /api/http-proxy (upstream 46ae7469): Settings › General's
 * global HTTP proxy switch and address, persisted in global settings.json and
 * applied immediately to the main process's undici dispatcher.
 */

type StatusBody = { status: number; body: Record<string, unknown> };

function proxyResponse(proxyUrl: string | undefined): StatusBody {
  const url = proxyUrl ? new URL(proxyUrl) : undefined;
  const body: HttpProxySettingsResponse = {
    enabled: !!url,
    // Display only: the saved URL may include proxy credentials.
    displayAddress: url ? `${url.protocol}//${url.host}` : null,
    sources: resolveHttpProxies(proxyUrl).sources,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}

function errorResponse(error: unknown): StatusBody {
  const message = error instanceof SyntaxError ? "Invalid JSON in global settings.json" : errorMessage(error);
  return { status: 500, body: { error: message } };
}

export async function httpProxyGet(): Promise<StatusBody> {
  try {
    const proxyUrl = await readGlobalSettings(getGlobalSettingsPath(), (settings) => parseHttpProxy(settings.httpProxy));
    return proxyResponse(proxyUrl);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function httpProxyPut(body: unknown): Promise<StatusBody> {
  const payload = body && typeof body === "object" ? body as { enabled?: unknown; httpProxy?: unknown } : null;
  if (typeof payload?.enabled !== "boolean") {
    return { status: 400, body: { error: "enabled must be a boolean" } };
  }
  const proxyUrl = payload.enabled ? parseHttpProxy(payload.httpProxy) : undefined;
  if (payload.enabled && !proxyUrl) {
    const missing = payload.httpProxy == null || (typeof payload.httpProxy === "string" && !payload.httpProxy.trim());
    return {
      status: 400,
      body: missing
        ? { reason: "proxy-required", error: "A proxy URL is required" }
        : { reason: "invalid-proxy", error: "Invalid proxy URL" },
    };
  }
  try {
    const settingsPath = getGlobalSettingsPath();
    if (proxyUrl || existsSync(settingsPath)) {
      await updateGlobalSettings(settingsPath, (settings) => {
        if (proxyUrl) settings.httpProxy = proxyUrl;
        else delete settings.httpProxy;
      });
    }
    // Apply the latest saved value under the read lock, including a concurrent save.
    return await readGlobalSettings(settingsPath, (settings) => {
      const savedProxy = parseHttpProxy(settings.httpProxy);
      setHttpProxy(savedProxy);
      return proxyResponse(savedProxy);
    });
  } catch (error) {
    return errorResponse(error);
  }
}
