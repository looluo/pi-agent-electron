import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("fork: branches at an entry and yields a new session id", async () => {
  const { app, page } = await launchApp();
  const cwd = process.env.E2E_CWD ?? process.cwd();

  // Reuse the slice-1 probe scenario: new session, one real prompt, fork at first entry.
  const created = await page.evaluate(async (cwdArg) => {
    const r = await window.pi.agentNew({ cwd: cwdArg, type: "ensure_session", toolNames: [] });
    return r.ok ? r.data.sessionId : null;
  }, cwd);
  const sid = created!;
  expect(sid).toBeTruthy();

  await page.evaluate(async (sidArg) => {
    await window.pi.agentCommand(sidArg, { type: "prompt", message: "Say hi" });
    for (let i = 0; i < 120; i++) {
      const r = await window.pi.agentCommand(sidArg, { type: "get_state" });
      const st = r.ok ? r.data : null;
      if (st && !st.isStreaming && !st.isPromptRunning) return true;
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  }, sid);

  const entryId = await page.evaluate(async (sidArg) => {
    const raw = await window.pi.sessionsGet(sidArg, {});
    const d = raw as { context?: { entryIds?: string[] } };
    return (d.context?.entryIds ?? [])[0] ?? null;
  }, sid);
  expect(entryId).toBeTruthy();

  const fork = await page.evaluate(async ([sidArg, entry]) => {
    const r = await window.pi.agentCommand(sidArg, { type: "fork", entryId: entry });
    return r.ok ? r.data : null;
  }, [sid, entryId] as const);
  expect(fork?.cancelled).toBe(false);
  expect(fork?.newSessionId).toBeTruthy();
  expect(fork!.newSessionId).not.toBe(sid);;

  // Upstream quirk (same in v0.8.9): continuing a forked session may re-key it
  // under the SDK's real session id, diverging from the id fork returned. The
  // product contract: the forked session accepts a follow-up prompt and produces
  // a reply (see fork-diag.mjs for the id-divergence trace).
  const followUp = await page.evaluate(async (newId) => {
    const r = await window.pi.agentCommand(newId, { type: "prompt", message: "Say ok" });
    if (!r.ok) return { prompted: false };
    for (let i = 0; i < 120; i++) {
      const s = await window.pi.agentCommand(newId, { type: "get_state" });
      const st = s.ok ? s.data : null;
      if (st && !st.isStreaming && !st.isPromptRunning) break;
      await new Promise((res) => setTimeout(res, 500));
    }
    // After the run, the forked file is owned by its real session id (upstream
    // cacheSessionPath evicts the fork-returned id when the real one registers).
    // Find the owning session via the list and read the reply there.
    const list = await window.pi.sessionsList(true);
    const owner = (list.sessions ?? []).find((x) => x.firstMessage?.includes("Say ok"));
    let reply = null;
    if (owner) {
      const t = await window.pi.agentCommand(owner.id, { type: "get_last_assistant_text" });
      reply = t.ok ? String(t.data.text) : null;
    }
    return { prompted: true, reply };
  }, fork!.newSessionId);
  expect(followUp.prompted).toBe(true);
  expect((followUp.reply ?? "").length).toBeGreaterThan(0);

  await app.close();
});
