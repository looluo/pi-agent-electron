import {
  readPowerShellToolEnabled,
  writePowerShellToolEnabled,
} from "@/lib/powershell-settings";
import {
  CODEMODE_INLINE_BUDGET_MAX,
  isCodemodeInlineBudget,
  isCodemodeMode,
  isCodemodePreference,
  readCodemodePreference,
  readCodemodeSettings,
  writeCodemodeInlineBudget,
  writeCodemodeMode,
  writeCodemodePreference,
} from "@/lib/codemode-settings";

type StatusBody = { status: number; body: Record<string, unknown> };

/** Port of app/api/tools/settings (GET) — shell tool preference + Code mode
 *  choice + Code mode tool list budget (upstream 1c387b4, 6c599e9). Both read
 *  the global defaultTools key, one after the other: each takes the file lock
 *  pi's SettingsManager takes too. */
export async function toolsSettingsGet(): Promise<StatusBody> {
  try {
    const { mode: codemodeMode, inlineBudget: codemodeInlineBudget } = await readCodemodeSettings();
    return {
      status: 200,
      body: {
        isWindows: process.platform === "win32",
        powerShellEnabled: await readPowerShellToolEnabled(),
        codemode: await readCodemodePreference(),
        codemodeMode,
        codemodeInlineBudget,
      },
    };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

/** Port of app/api/tools/settings (PUT) — the only writer of the global
 *  defaultTools key: the PowerShell switch (Windows) and the Code mode choice
 *  (ADR 0006, chosen in Settings › MCP) both edit it. Settings › MCP saves the
 *  global `codemode.inlineBudget` here too, under the same lock.
 *  request-security checks are HTTP concerns; the typed IPC channel is only
 *  reachable from the renderer. Send exactly one of { enabled }, { codemode }
 *  or { codemodeInlineBudget }. */
const CHANGES = ["enabled", "codemode", "codemodeMode", "codemodeInlineBudget"] as const;

export async function toolsSettingsPut(changes: {
  enabled?: unknown;
  codemode?: unknown;
  codemodeMode?: unknown;
  codemodeInlineBudget?: unknown;
}): Promise<StatusBody> {
  const body = changes && typeof changes === "object" ? changes : {};
  if (CHANGES.filter((key) => key in body).length !== 1) {
    return { status: 400, body: { error: "Send one of enabled (PowerShell), codemode, codemodeMode or codemodeInlineBudget" } };
  }

  if ("codemodeMode" in body) {
    // "on" removes the key: it is pi's default.
    if (!isCodemodeMode(body.codemodeMode)) {
      return { status: 400, body: { error: 'codemodeMode must be "on" or "only"' } };
    }
    try {
      await writeCodemodeMode(body.codemodeMode);
      return await toolsSettingsGet();
    } catch (error) {
      return { status: 500, body: { error: String(error) } };
    }
  }

  if ("codemodeInlineBudget" in body) {
    // null removes the key, which gives sessions pi's default.
    const budget = body.codemodeInlineBudget;
    if (budget !== null && !isCodemodeInlineBudget(budget)) {
      return {
        status: 400,
        body: {
          error: `codemodeInlineBudget must be a whole number from 0 to ${CODEMODE_INLINE_BUDGET_MAX}, or null`,
        },
      };
    }
    try {
      await writeCodemodeInlineBudget(budget ?? undefined);
      return await toolsSettingsGet();
    } catch (error) {
      return { status: 500, body: { error: String(error) } };
    }
  }
  try {
    if ("codemode" in body) {
      if (!isCodemodePreference(body.codemode)) {
        return { status: 400, body: { error: 'codemode must be "automatic" or "always"' } };
      }
      await writeCodemodePreference(body.codemode);
      return await toolsSettingsGet();
    }
    if (process.platform !== "win32") {
      return { status: 404, body: { error: "PowerShell tool settings are only available on Windows" } };
    }
    if (typeof body.enabled !== "boolean") {
      return { status: 400, body: { error: "enabled must be a boolean" } };
    }
    await writePowerShellToolEnabled(body.enabled);
    return await toolsSettingsGet();
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}
