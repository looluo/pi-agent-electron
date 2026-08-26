import {
  readPowerShellToolEnabled,
  writePowerShellToolEnabled,
} from "@/lib/powershell-settings";

type StatusBody = { status: number; body: Record<string, unknown> };

/** Port of app/api/tools/settings (GET) — shell tool preference. */
export async function toolsSettingsGet(): Promise<StatusBody> {
  try {
    return {
      status: 200,
      body: {
        isWindows: process.platform === "win32",
        powerShellEnabled: await readPowerShellToolEnabled(),
      },
    };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

/** Port of app/api/tools/settings (PUT) — request-security checks are HTTP
 *  concerns; the typed IPC channel is only reachable from the renderer. */
export async function toolsSettingsPut(enabled: unknown): Promise<StatusBody> {
  if (process.platform !== "win32") {
    return { status: 404, body: { error: "PowerShell tool settings are only available on Windows" } };
  }
  try {
    if (typeof enabled !== "boolean") {
      return { status: 400, body: { error: "enabled must be a boolean" } };
    }
    return {
      status: 200,
      body: {
        isWindows: true,
        powerShellEnabled: await writePowerShellToolEnabled(enabled),
      },
    };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}
