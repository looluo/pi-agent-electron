import { test, expect } from "@playwright/test";
import { createAgentHomeFixture, launchApp } from "./helpers";

/**
 * Regression: expanding a deferred thinking block in a saved session must load
 * the full thinking content over IPC (pi:sessions:thinking). The upstream
 * pi-web fetch("/api/sessions/.../thinking") port once left a dead HTTP call
 * in the renderer, so every expand showed "Failed to fetch".
 */

const FIXTURE_FIRST_MESSAGE = "thinking fixture e2e";
const THINKING_MARKER = "THINKING-FULL-CONTENT-MARKER-9f3a";

/** One session with a deferred-able thinking block: only the first line is
 *  the preview; the marker lives past it and only loads on expand. */
function writeSessionFixture(): string {
  const lines = [
    JSON.stringify({
      type: "message", id: "e2e-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: FIXTURE_FIRST_MESSAGE }] },
    }),
    JSON.stringify({
      type: "message", id: "e2e-a1", parentId: "e2e-u1", timestamp: "2026-09-08T00:00:02.000Z",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: `short fixture preview line\n${THINKING_MARKER} full reasoning body follows the preview and only loads on expand` },
          { type: "text", text: "fixture reply" },
        ],
        model: "fixture-model", provider: "fixture-provider", usage: { input: 1, output: 1 },
      },
    }),
  ];
  return createAgentHomeFixture(lines);
}

test("expanding deferred thinking loads full content over IPC", async () => {
  const agentHome = writeSessionFixture();
  const { app, page } = await launchApp({ PI_CODING_AGENT_DIR: agentHome });

  // Open the fixture session from the sidebar (row title = first message).
  // Session rows are clickable divs, not buttons — match the row text.
  const row = page.getByText(FIXTURE_FIRST_MESSAGE).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  // Saved history groups thinking under a "process details" toggle
  // (chat.processDetails) — expand it to reveal the thinking block first.
  const details = page.getByRole("button", { name: /处理详情|Process details/i }).first();
  await expect(details).toBeVisible({ timeout: 20_000 });
  await details.click();

  // The thinking block renders collapsed (preview only). Expand it — the
  // aria-label is locale-prefixed ("Thinking..." / "思考...").
  const expander = page.locator('button[aria-expanded][aria-label^="Thinking"], button[aria-expanded][aria-label^="思考"]').first();
  await expect(expander).toBeVisible({ timeout: 20_000 });
  await expander.click();

  // Full content must arrive; the dead-fetch symptom must not appear.
  await expect(page.getByText(THINKING_MARKER)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);

  await app.close();
});
