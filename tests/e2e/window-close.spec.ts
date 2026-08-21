import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("window close kills the app process (Q4: close = stop)", async () => {
  const { app, page } = await launchApp();

  // Close via the actual window (CloseRequested path), then verify the
  // process exits — _electron.launch resolves processExit.
  const exitPromise = app.process().exitCode !== null
    ? Promise.resolve(app.process().exitCode)
    : new Promise<number | null>((resolve) => app.process().once("exit", (code) => resolve(code)));

  await page.close({ runBeforeUnload: false });
  // window-all-closed → app.quit() (ADR-0003).
  const code = await exitPromise;
  expect(code).not.toBe(undefined);

  await app.close().catch(() => undefined);
});
