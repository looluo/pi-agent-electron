import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("auth settings surface: provider lists and api-key status work", async () => {
  const { app, page } = await launchApp();

  const oauth = await page.evaluate(async () => {
    const d = await window.pi.authProviders();
    return { n: d.providers?.length ?? 0 };
  });
  expect(oauth.n).toBeGreaterThan(0);

  const apiKeys = await page.evaluate(async () => {
    const d = await window.pi.authAllProviders();
    return { n: d.providers?.length ?? 0 };
  });
  expect(apiKeys.n).toBeGreaterThan(0);

  // Status must never leak the raw key.
  const sample = await page.evaluate(async () => {
    const d = await window.pi.authAllProviders();
    const p = d.providers?.[0];
    if (!p) return null;
    const raw = await window.pi.apiKeyStatus(p.id);
    return JSON.stringify(raw);
  });
  if (sample) {
    expect(sample).not.toMatch(/"apiKey"\s*:\s*"[^"]/);
  }

  await app.close();
});
