import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("a real tool call round-trips and is retrievable", async ({ }, testInfo) => {
  testInfo.setTimeout(180_000);
  const { app, page } = await launchApp();
  const cwd = process.env.E2E_CWD ?? process.cwd();

  const created = await page.evaluate(async (cwdArg) => {
    const r = await window.pi.agentNew({ cwd: cwdArg, type: "ensure_session", toolNames: ["read"] });
    return r.ok ? r.data.sessionId : null;
  }, cwd);
  expect(created).toBeTruthy();
  const sid = created!;

  const prompted = await page.evaluate(async (sidArg) => {
    const r = await window.pi.agentCommand(sidArg, {
      type: "prompt",
      message: "Use the read tool to read package.json in the current directory, then reply with just the package name from it.",
    });
    return r.ok;
  }, sid);
  expect(prompted).toBe(true);

  const settled = await page.evaluate(async (sidArg) => {
    for (let i = 0; i < 180; i++) {
      const r = await window.pi.agentCommand(sidArg, { type: "get_state" });
      const st = r.ok ? r.data : null;
      if (st && !st.isStreaming && !st.isPromptRunning) return true;
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  }, sid);
  expect(settled).toBe(true);

  // The session context must now contain a toolCall/toolResult pair.
  const context = await page.evaluate(async (sidArg) => {
    const raw = await window.pi.sessionsGet(sidArg, {});
    const d = raw as { context?: { messages: Array<{ role: string; content: unknown }> } };
    return d.context?.messages ?? [];
  }, sid);
  const roles = context.map((m) => m.role);
  expect(roles).toContain("toolResult");

  await app.close();
});
