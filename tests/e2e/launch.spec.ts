import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("launch: window opens with the app shell and a live bridge", async () => {
  const { app, page } = await launchApp();

  const title = await page.title();
  expect(title).toContain("Pi");

  // The bridge must be exposed (preload loaded under sandbox+contextIsolation).
  const hasBridge = await page.evaluate(() => typeof window.pi === "object");
  expect(hasBridge).toBe(true);

  // The app shell renders (sidebar or chat placeholder visible).
  await expect(page.locator("body")).toBeVisible();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  expect(bodyText.length).toBeGreaterThan(0);

  await app.close();
});
