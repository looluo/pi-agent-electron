import { test, expect } from "@playwright/test";
import { createAgentHomeFixture, launchApp } from "./helpers";

/**
 * Regression: plugin install must work when the app is launched with a
 * GUI-like environment. macOS Finder/Dock launches inherit launchd's minimal
 * PATH (/usr/bin:/bin:/usr/sbin:/sbin), so DefaultPackageManager's
 * spawn("npm", …) failed with ENOENT ("spawn npm ENOENT" in the install
 * dialog). The main process now repairs PATH at startup (static tool dirs
 * + login-shell capture). This spec scrubs PATH to the launchd shape to
 * reproduce the GUI launch and installs a real npm package over IPC.
 *
 * macOS-only: Windows GUI launches inherit the full registry PATH (system +
 * user), the minimal-PATH environment does not exist there, and the PATH
 * repair is deliberately a no-op on win32.
 */

const isWindows = process.platform === "win32";

test.skip(isWindows, "launchd minimal-PATH launches are macOS-only; win32 GUI launches inherit the full registry PATH");

test("plugin install survives a launchd-like minimal PATH", async () => {
  const agentHome = createAgentHomeFixture([
    JSON.stringify({
      type: "message", id: "path-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: "path fixture e2e" }] },
    }),
  ]);
  const { app, page } = await launchApp({
    PI_CODING_AGENT_DIR: agentHome,
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin", // launchd default, no /opt/homebrew/bin
  });

  const cwd = (await page.evaluate("window.pi.defaultCwd()")) as { cwd: string };
  expect(cwd.cwd).toBeTruthy();

  const install = await page.evaluate(
    `window.pi.pluginsAction({ action: "install", source: "npm:is-odd@3.0.1", scope: "global", cwd: ${JSON.stringify(cwd.cwd)} })`,
  ) as { status: number; body?: { error?: string; packages?: { source: string; status: string }[] } };

  // The dead symptom must not appear; the package must be installed.
  expect(install.body?.error).toBeUndefined();
  expect(install.status).toBe(200);
  const pkg = install.body?.packages?.find((p) => p.source === "npm:is-odd@3.0.1");
  expect(pkg?.status).toMatch(/^(installed|loaded)$/);

  await app.close();
});
