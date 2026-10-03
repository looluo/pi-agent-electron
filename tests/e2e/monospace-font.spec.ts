import { _electron, test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAIN_JS } from "./helpers";

test("code font renders equal-width Latin glyphs in light and dark themes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-monospace-e2e-"));
  const app = await _electron.launch({
    args: [MAIN_JS, `--user-data-dir=${join(directory, "profile")}`],
    env: { ...process.env, NODE_ENV: "production", PI_CODING_AGENT_DIR: join(directory, "agent") },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim());
    const measurements = await page.evaluate(() => {
      const results: { theme: string; kind: string; narrow: number; wide: number }[] = [];
      const originalTheme = document.documentElement.dataset.theme;
      try {
        for (const theme of ["light", "dark"]) {
          document.documentElement.dataset.theme = theme;
          // The highlighted, lightweight and diff views all consume this same
          // variable. Measure real DOM glyphs, not just the declared font name.
          for (const kind of ["code", "lightweight", "diff"]) {
            const container = document.createElement(kind === "code" ? "code" : "div");
            container.style.cssText = "position:fixed;font-family:var(--font-mono);font-size:13px;white-space:pre";
            const narrow = document.createElement("span");
            const wide = document.createElement("span");
            narrow.textContent = "iiiiii";
            wide.textContent = "WWWWWW";
            container.append(narrow, wide);
            document.body.append(container);
            try {
              results.push({ theme, kind, narrow: narrow.getBoundingClientRect().width, wide: wide.getBoundingClientRect().width });
            } finally {
              container.remove();
            }
          }
        }
      } finally {
        if (originalTheme === undefined) delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = originalTheme;
      }
      return results;
    });
    for (const result of measurements) {
      expect(result.narrow).toBeGreaterThan(0);
      expect(Math.abs(result.narrow - result.wide), `${result.theme}/${result.kind} must be monospace`).toBeLessThan(0.1);
    }
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
