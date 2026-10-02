import {
  readPowerShellToolEnabled,
  writePowerShellToolEnabled,
} from "@/lib/powershell-settings";
import {
  isCodemodePreference,
  readCodemodePreference,
  writeCodemodePreference,
} from "@/lib/codemode-settings";

type StatusBody = { status: number; body: Record<string, unknown> };

/** Port of app/api/tools/settings (GET) — shell tool preference + Code mode
 *  choice (upstream 1c387b4). Both read the global defaultTools key, one after
 *  the other: each takes the file lock pi's SettingsManager takes too. */
export async function toolsSettingsGet(): Promise<StatusBody> {
  try {
    return {
      status: 200,
      body: {
        isWindows: process.platform === "win32",
        powerShellEnabled: await readPowerShellToolEnabled(),
        codemode: await readCodemodePreference(),
      },
    };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

/** Port of app/api/tools/settings (PUT) — the only writer of the global
 *  defaultTools key: the PowerShell switch (Windows) and the Code mode choice
 *  (ADR 0006, chosen in Settings › MCP) both edit it. request-security checks
 *  are HTTP concerns; the typed IPC channel is only reachable from the
 *  renderer. Send either { enabled } or { codemode }, not both. */
export async function toolsSettingsPut(changes: {
  enabled?: unknown;
  codemode?: unknown;
}): Promise<StatusBody> {
  const body = changes && typeof changes === "object" ? changes : {};
  if (("codemode" in body) === ("enabled" in body)) {
    return { status: 400, body: { error: "Send either enabled (PowerShell) or codemode" } };
  }
  try {
    if ("codemode" in body) {
      if (!isCodemodePreference(body.codemode)) {
        return { status: 400, body: { error: 'codemode must be "automatic" or "always"' } };
      }
      return {
        status: 200,
        body: {
          isWindows: process.platform === "win32",
          powerShellEnabled: await readPowerShellToolEnabled(),
          codemode: await writeCodemodePreference(body.codemode),
        },
      };
    }
    if (process.platform !== "win32") {
      return { status: 404, body: { error: "PowerShell tool settings are only available on Windows" } };
    }
    if (typeof body.enabled !== "boolean") {
      return { status: 400, body: { error: "enabled must be a boolean" } };
    }
    return {
      status: 200,
      body: {
        isWindows: true,
        powerShellEnabled: await writePowerShellToolEnabled(body.enabled),
        codemode: await readCodemodePreference(),
      },
    };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}
