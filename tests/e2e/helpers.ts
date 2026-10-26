import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const ROOT = resolve(__dirname, "..", "..");
export const MAIN_JS = resolve(ROOT, "out", "main", "main.mjs");

function testDirectory(): string {
  const directory = process.env.PI_E2E_TEST_DIR;
  if (!directory) throw new Error("E2E isolation was not initialized by globalSetup");
  return directory;
}

/** Create an isolated agent home (sessions root) containing exactly one
 *  session file for a workspace under it. `entries` are the JSONL entries
 *  after the session header (which the helper writes with cwd=workspace). */
export async function createAgentHomeFixture(entries: string[]): Promise<string> {
  const agentHome = join(testDirectory(), "fixture-agent");
  rmSync(agentHome, { recursive: true, force: true });
  const workspace = join(agentHome, "workspace");
  mkdirSync(workspace, { recursive: true });
  // Pass the session directory explicitly: the test runner's agent home is
  // different from the fixture agent home passed to the Electron child.
  const { SessionManager } = await import("@earendil-works/pi-coding-agent");
  const sessionDir = dirname(SessionManager.create(workspace, join(agentHome, "sessions", "fixture")).getSessionFile());
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
    args: [MAIN_JS, "--user-data-dir", join(testDirectory(), "user-data"), "--remote-allow-origins=*"],
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
