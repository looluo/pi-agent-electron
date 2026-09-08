import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(__dirname, "..", "..");
export const MAIN_JS = resolve(ROOT, "out", "main", "main.mjs");

/** Create an isolated agent home (sessions root) containing exactly one
 *  session file for a workspace under it. `entries` are the JSONL entries
 *  after the session header (which the helper writes with cwd=workspace). */
export function createAgentHomeFixture(entries: string[]): string {
  const agentHome = resolve(ROOT, "tests", ".e2e-agent-home");
  rmSync(agentHome, { recursive: true, force: true });
  const workspace = join(agentHome, "workspace");
  mkdirSync(workspace, { recursive: true });
  const encodedCwd = `-${workspace.split("/").join("-")}-`;
  const sessionDir = join(agentHome, "sessions", encodedCwd);
  mkdirSync(sessionDir, { recursive: true });
  const header = JSON.stringify({
    type: "session", version: 3, id: "01e2e000-0000-7000-8000-00000000f1a7",
    timestamp: "2026-09-08T00:00:00.000Z", cwd: workspace,
  });
  writeFileSync(
    join(sessionDir, "2026-09-08T00-00-00-000Z_01e2e000-0000-7000-8000-00000000f1a7.jsonl"),
    [header, ...entries].join("\n") + "\n",
  );
  return agentHome;
}

/** Launch the built app (run `npm run build` first) with a clean userData dir.
 *  `extraEnv` overrides the main-process environment (e.g. an isolated
 *  PI_CODING_AGENT_DIR for session fixtures). */
export async function launchApp(extraEnv?: Record<string, string>): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    args: [MAIN_JS, "--user-data-dir", resolve(ROOT, "tests", ".user-data"), "--remote-allow-origins=*"],
    env: { ...process.env, NODE_ENV: "production", ...extraEnv },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

/** Evaluate inside the renderer (window context). */
export async function evalPi<T>(page: Page, expression: string): Promise<T> {
  return page.evaluate(expression);
}
