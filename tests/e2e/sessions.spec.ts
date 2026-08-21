import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("session list returns sessions and switching loads context", async () => {
  const { app, page } = await launchApp();

  const list = await page.evaluate(async () => {
    const raw = await window.pi.sessionsList();
    return raw as { sessions?: Array<{ id: string; cwd?: string }>; runningSessionIds?: string[]; error?: string };
  });
  expect(list.error).toBeUndefined();
  expect(Array.isArray(list.sessions)).toBe(true);

  if ((list.sessions ?? []).length > 0) {
    const target = list.sessions![0];
    const loaded = await page.evaluate(async (id) => {
      const raw = await window.pi.sessionsGet(id, { deferThinking: true, deferMedia: true });
      const d = raw as { context?: { messages: unknown[] }; error?: string };
      return d;
    }, target.id);
    expect(loaded.error).toBeUndefined();
    expect(loaded.context).toBeTruthy();
  }

  await app.close();
});
