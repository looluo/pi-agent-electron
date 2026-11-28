import { existsSync } from "node:fs";
import { getGlobalSettingsPath, readGlobalSettings, updateGlobalSettings } from "@/lib/global-settings-file";
import { errorMessage } from "@/lib/errors";
import { applyQueueModesToLiveSessions } from "@/lib/rpc-manager";

/**
 * Ports of GET/PUT /api/queue-modes (upstream 29654472 / 7e9d663a): Settings ›
 * General's choices for pi's own `steeringMode` and `followUpMode`. Written to
 * global settings.json under pi's file lock and applied to every live session.
 */

type StatusBody = { status: number; body: Record<string, unknown> };
type QueueMode = "one-at-a-time" | "all";
type QueueModes = { steeringMode: QueueMode; followUpMode: QueueMode };
const KEYS = ["steeringMode", "followUpMode"] as const;

function queueMode(value: unknown): QueueMode {
  return value === "all" ? "all" : "one-at-a-time";
}

async function readModes(): Promise<QueueModes> {
  return readGlobalSettings(getGlobalSettingsPath(), (settings) => ({
    steeringMode: queueMode("steeringMode" in settings ? settings.steeringMode : settings.queueMode),
    followUpMode: queueMode(settings.followUpMode),
  }));
}

export async function queueModesGet(): Promise<StatusBody> {
  try {
    return { status: 200, body: await readModes() };
  } catch (error) {
    return { status: 500, body: { error: errorMessage(error) } };
  }
}

export async function queueModesPut(body: unknown): Promise<StatusBody> {
  const update: Partial<QueueModes> = {};
  for (const key of KEYS) {
    const value = (body as Record<string, unknown> | null)?.[key];
    if (value === undefined) continue;
    if (value !== "one-at-a-time" && value !== "all") {
      return { status: 400, body: { error: `${key} must be "one-at-a-time" or "all"` } };
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return { status: 400, body: { error: "Nothing to change: give steeringMode or followUpMode" } };
  }
  try {
    if (Object.values(update).includes("all") || existsSync(getGlobalSettingsPath())) {
      await updateGlobalSettings(getGlobalSettingsPath(), (settings) => {
        for (const key of KEYS) {
          const mode = update[key];
          if (mode === "all") settings[key] = "all";
          else if (mode) delete settings[key];
        }
        if (update.steeringMode) delete settings.queueMode;
      });
    }
    await applyQueueModesToLiveSessions();
    return { status: 200, body: await readModes() };
  } catch (error) {
    return { status: 500, body: { error: errorMessage(error) } };
  }
}
