import { test, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { createAgentHomeFixture, launchApp } from "./helpers";

/**
 * Regression: "view full output" on a truncated user-run bash execution must
 * load the full log over IPC (pi:agent:bash-output). The upstream pi-web port
 * once left fetch("/api/agent/{id}/bash-output") in the renderer — dead under
 * the file:// origin, so the button showed "(Failed to fetch)".
 */

const FIXTURE_FIRST_MESSAGE = "bash fixture e2e";
const FULL_MARKER = "BASH-FULL-OUTPUT-MARKER-77ce";

test("view full output loads the truncated bash log over IPC", async () => {
  // The IPC handler only serves files directly inside os.tmpdir() named
  // pi-bash-*.log that the session's bashExecution entry references verbatim.
  const bashLog = join(tmpdir(), "pi-bash-e2e77ce.log");
  writeFileSync(bashLog, `head line\n${FULL_MARKER} tail of the full log that the truncated preview omits\n`);

  const lines = [
    JSON.stringify({
      type: "message", id: "e2e-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: FIXTURE_FIRST_MESSAGE }] },
    }),
    JSON.stringify({
      type: "message", id: "e2e-b1", parentId: "e2e-u1", timestamp: "2026-09-08T00:00:02.000Z",
      message: {
        role: "bashExecution",
        command: "echo fixture-long-output",
        output: "head line … (truncated preview)",
        exitCode: 0,
        truncated: true,
        fullOutputPath: bashLog,
      },
    }),
  ];
  const agentHome = createAgentHomeFixture(lines);
  const { app, page } = await launchApp({ PI_CODING_AGENT_DIR: agentHome });

  const row = page.getByText(FIXTURE_FIRST_MESSAGE).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  // "view full output" is a plain-text button rendered under the bash block.
  const viewFull = page.getByRole("button", { name: "view full output" });
  await expect(viewFull).toBeVisible({ timeout: 20_000 });
  await viewFull.click();

  // The full log replaces the preview inside the (collapsed) tool-call pane —
  // expand the bash block to expose it.
  const bashHeader = page.getByRole("button", { name: /bash echo fixture-long-output/ });
  await expect(bashHeader).toBeVisible({ timeout: 10_000 });
  await bashHeader.click();

  // Full log must arrive; the dead-fetch symptom must not appear.
  await expect(page.getByText(new RegExp(FULL_MARKER))).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Failed to fetch/)).toHaveCount(0);

  await app.close();
});
