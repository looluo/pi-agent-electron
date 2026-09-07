import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

// Regression: the pi:terminal:subscribe response once carried an unsubscribe
// FUNCTION back over IPC — structured clone rejected it and every terminal tab
// opened with "An object could not be cloned". This spec drives the real
// bridge: create → subscribe (replay handshake must resolve, not reject) →
// write a command → read pushed output → clean up.
test("terminal: workspace PTY round-trips over typed IPC", async () => {
  const { app, page } = await launchApp();
  const cwd = process.env.E2E_CWD ?? process.cwd();

  const result = await page.evaluate(async (workdir: string) => {
    const collected: string[] = [];
    const marker = `probe-${Date.now()}`;
    const created = await window.pi.terminalCreate(workdir, 80, 24, "e2e-terminal-1");
    if (created.status !== 200 || created.body.id !== "e2e-terminal-1") {
      return { ok: false, stage: "create", created };
    }
    const sub = window.pi.terminalSubscribe(
      "e2e-terminal-1",
      undefined,
      (frame) => {
        if (frame.event === "output") collected.push(String(frame.data.data));
      },
    );
    const handshake = await sub.ready;
    if (handshake.status !== 200) {
      sub.stop();
      return { ok: false, stage: "subscribe", handshake };
    }
    // The subscribe response must be structured-clone safe and resolved.
    if (typeof (handshake as unknown as { unsubscribe?: unknown }).unsubscribe !== "undefined") {
      sub.stop();
      return { ok: false, stage: "clone-leak", handshake };
    }
    await window.pi.terminalWrite("e2e-terminal-1", `echo ${marker}\r`);
    const deadline = Date.now() + 15_000;
    let sawMarker = false;
    while (Date.now() < deadline) {
      if (collected.join("").includes(marker)) { sawMarker = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    sub.stop();
    const killed = await window.pi.terminalKill("e2e-terminal-1");
    return { ok: sawMarker, stage: "echo", replayBytes: handshake.body.replay?.data?.length ?? 0 };
  }, cwd);

  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });

  await app.close();
});
