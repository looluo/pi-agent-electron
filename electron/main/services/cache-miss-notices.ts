import { existsSync } from "fs";
import { getGlobalSettingsPath, readGlobalSettings, updateGlobalSettings } from "@/lib/global-settings-file";

/**
 * Ports of GET/PUT /api/cache-miss-notices (upstream 653cd7c): Settings ›
 * General's switch for pi's own `showCacheMissNotices`, in the global
 * settings.json under the lock pi's SettingsManager takes. Off is pi's
 * default, so turning it off removes the key. A project's .pi/settings.json
 * still overrides it, as in pi.
 */

type StatusBody = { status: number; body: Record<string, unknown> };

const KEY = "showCacheMissNotices";

async function readEnabled(): Promise<boolean> {
  return readGlobalSettings(getGlobalSettingsPath(), (settings) => settings[KEY] === true);
}

export async function cacheMissNoticesGet(): Promise<StatusBody> {
  try {
    return { status: 200, body: { enabled: await readEnabled() } };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function cacheMissNoticesPut(enabled: unknown): Promise<StatusBody> {
  if (typeof enabled !== "boolean") {
    return { status: 400, body: { error: "enabled must be a boolean" } };
  }
  try {
    // Off with no settings file is already pi's default: nothing to create.
    if (!enabled && !existsSync(getGlobalSettingsPath())) return { status: 200, body: { enabled: false } };
    await updateGlobalSettings(getGlobalSettingsPath(), (settings) => {
      if (enabled) settings[KEY] = true;
      else delete settings[KEY];
    });
    return { status: 200, body: { enabled: await readEnabled() } };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
