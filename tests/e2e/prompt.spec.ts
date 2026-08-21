import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("prompt → reply round trip through the real UI contract", async () => {
  const { app, page } = await launchApp();
  const cwd = process.env.E2E_CWD ?? process.cwd();

  // Create a session through the same facade the UI uses.
  const created = await page.evaluate(async (cwdArg) => {
    const result = await window.pi.agentNew({ cwd: cwdArg, type: "ensure_session", toolNames: [] });
    return result.ok ? result.data : null;
  }, cwd);
  expect(created?.sessionId).toBeTruthy();

  const sid = created!.sessionId;

  // Send a real prompt (LLM).
  const prompted = await page.evaluate(async (sidArg) => {
    const r = await window.pi.agentCommand(sidArg, { type: "prompt", message: "Reply with exactly: E2E_OK" });
    return r.ok;
  }, sid);
  expect(prompted).toBe(true);

  // Wait for the run to settle, then read the reply.
  const settled = await page.evaluate(async (sidArg) => {
    for (let i = 0; i < 120; i++) {
      const r = await window.pi.agentCommand(sidArg, { type: "get_state" });
      const st = r.ok ? r.data : null;
      if (st && !st.isStreaming && !st.isPromptRunning) return true;
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  }, sid);
  expect(settled).toBe(true);

  const reply = await page.evaluate(async (sidArg) => {
    const r = await window.pi.agentCommand(sidArg, { type: "get_last_assistant_text" });
    return r.ok ? String(r.data.text) : null;
  }, sid);
  expect(reply ?? "").toContain("E2E_OK");

  await app.close();
});
