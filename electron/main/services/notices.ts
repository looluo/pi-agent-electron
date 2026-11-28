import { existsSync } from "node:fs";
import { getGlobalSettingsPath, readGlobalSettings, updateGlobalSettings } from "@/lib/global-settings-file";
import { errorMessage } from "@/lib/errors";
import { isRecord } from "@/lib/is-record";
import { DEFAULT_NOTICE_SETTINGS, isNoticeSettingKey, type NoticeSettings } from "@/lib/transcript-notices";
import { migrateNoticeSettings, noticeSettingsOf } from "@/lib/transcript-notices-server";

/**
 * Ports of GET/PUT /api/notices (upstream pi 1.6.1 `notices.*`, superseding
 * cache-miss-notices): Settings › General's switches for pi's transcript
 * notices in global settings.json.
 */

type StatusBody = { status: number; body: Record<string, unknown> };

async function readNotices(): Promise<NoticeSettings> {
  return readGlobalSettings(getGlobalSettingsPath(), (settings) => ({
    ...DEFAULT_NOTICE_SETTINGS,
    ...noticeSettingsOf(settings),
  }));
}

export async function noticesGet(): Promise<StatusBody> {
  try {
    return { status: 200, body: { notices: await readNotices() } };
  } catch (error) {
    return { status: 500, body: { error: errorMessage(error) } };
  }
}

export async function noticesPut(body: unknown): Promise<StatusBody> {
  const { key, shown } = isRecord(body) ? body : {};
  if (!isNoticeSettingKey(key)) {
    return { status: 400, body: { error: "key must be one of pi's notices settings" } };
  }
  if (typeof shown !== "boolean") {
    return { status: 400, body: { error: "shown must be a boolean" } };
  }
  try {
    if (!shown && !existsSync(getGlobalSettingsPath())) {
      return { status: 200, body: { notices: { ...DEFAULT_NOTICE_SETTINGS } } };
    }
    await updateGlobalSettings(getGlobalSettingsPath(), (settings) => {
      migrateNoticeSettings(settings);
      settings.notices = { ...(isRecord(settings.notices) ? settings.notices : {}), [key]: shown };
    });
    return { status: 200, body: { notices: await readNotices() } };
  } catch (error) {
    return { status: 500, body: { error: errorMessage(error) } };
  }
}
