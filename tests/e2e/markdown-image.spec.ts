import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAgentHomeFixture, launchApp } from "./helpers";

/**
 * Regression: local images referenced by markdown in saved messages must load
 * through the pifile:// protocol. The upstream pi-web port once built
 * src="/api/files/...?type=read" — dead under the file:// origin, so every
 * inline local image rendered as a broken image.
 */

const FIXTURE_FIRST_MESSAGE = "markdown image fixture e2e";

/** 1x1 transparent PNG. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("markdown local image loads via pifile protocol", async () => {
  const agentHome = resolveAgentHome();
  const { app, page } = await launchApp({ PI_CODING_AGENT_DIR: agentHome });

  const row = page.getByText(FIXTURE_FIRST_MESSAGE).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  // Wait for the assistant message to render, then for the img to load.
  const img = page.locator('img[alt="fixture shot"]');
  await expect(img).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);

  await app.close();
});

function resolveAgentHome(): string {
  const lines = [
    JSON.stringify({
      type: "message", id: "e2e-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: FIXTURE_FIRST_MESSAGE }] },
    }),
    JSON.stringify({
      type: "message", id: "e2e-a1", parentId: "e2e-u1", timestamp: "2026-09-08T00:00:02.000Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Here is the screenshot:\n\n![fixture shot](screenshot.png)" }],
        model: "fixture-model", provider: "fixture-provider", usage: { input: 1, output: 1 },
      },
    }),
  ];
  const agentHome = createAgentHomeFixture(lines);
  // The markdown src is relative — resolveLocalFileHref anchors it on the
  // session cwd, which is the fixture workspace.
  writeFileSync(join(agentHome, "workspace", "screenshot.png"), PNG_BYTES);
  return agentHome;
}
