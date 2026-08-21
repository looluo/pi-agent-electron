import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import { resolve } from "node:path";

export const ROOT = resolve(__dirname, "..", "..");
export const MAIN_JS = resolve(ROOT, "out", "main", "main.mjs");

/** Launch the built app (run `npm run build` first) with a clean userData dir. */
export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    args: [MAIN_JS, "--user-data-dir", resolve(ROOT, "tests", ".user-data"), "--remote-allow-origins=*"],
    env: { ...process.env, NODE_ENV: "production" },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

/** Evaluate inside the renderer (window context). */
export async function evalPi<T>(page: Page, expression: string): Promise<T> {
  return page.evaluate(expression);
}
