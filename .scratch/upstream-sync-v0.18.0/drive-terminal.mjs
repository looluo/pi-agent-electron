#!/usr/bin/env node
/**
 * Verification driver for the Pi Agent App (Electron).
 * See ../SKILL.md. Mirrors the launch/isolation recipe of tests/e2e/helpers.ts
 * and setup.ts, but runs standalone (no Playwright test runner).
 *
 * Usage (from the repo root):
 *   node .claude/skills/verify-pi-agent-app/scripts/drive.mjs doctor
 *   node .claude/skills/verify-pi-agent-app/scripts/drive.mjs <journey> [--keep] [--evidence-dir <dir>]
 *
 * Journeys (one per entry in ../features/):
 *   shell             launch from an empty data dir; window, bridge, app shell
 *   session-history   open a fixture session from the sidebar; context renders
 *   bash-full-output  truncated bash log loads over IPC from the UI button
 *   terminal          workspace PTY round-trips over typed IPC
 *   prompt-reply      live LLM round trip through the same facade the UI uses
 *
 * Exit codes: 0 pass, 1 fail, 2 usage error, 3 skipped (precondition unmet).
 * Evidence survives cleanup under tests/.artifacts/verify/<run>/ (gitignored).
 */
import { _electron } from "@playwright/test";
import { constants, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..", "..");
const MAIN_JS = join(ROOT, "out", "main", "main.mjs");
const EVIDENCE_ROOT = join(ROOT, "tests", ".artifacts", "verify");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const args = process.argv.slice(2);
const command = args[0];
const keep = args.includes("--keep");
const evidenceDirFlagIdx = args.indexOf("--evidence-dir");
const evidenceDir =
  evidenceDirFlagIdx !== -1 && args[evidenceDirFlagIdx + 1]
    ? resolve(args[evidenceDirFlagIdx + 1])
    : join(EVIDENCE_ROOT, `${command ?? "run"}-${STAMP}`);

class VerifyError extends Error {}

// ---------------------------------------------------------------- recording

const record = { command, startedAt: new Date().toISOString(), steps: [], result: "PASS", evidence: {} };
const t0 = Date.now();

function step(name, detail = "") {
  record.steps.push({ name, detail, ms: Date.now() - t0 });
  process.stdout.write(`  [ok] ${name}${detail ? ` — ${detail}` : ""}\n`);
}

function finish(result, note = "") {
  record.result = result;
  if (note) record.note = note;
}

async function writeFacts() {
  mkdirSync(evidenceDir, { recursive: true });
  record.finishedAt = new Date().toISOString();
  record.evidenceDir = evidenceDir;
  writeFileSync(join(evidenceDir, "facts.json"), JSON.stringify(record, null, 2));
}

// ---------------------------------------------------------------- agent home

async function getRealAgentDir() {
  const { getAgentDir } = await import("@earendil-works/pi-coding-agent");
  return getAgentDir();
}

/** Copy credentials/config (never sessions) from the real agent home into a
 *  disposable one, exactly like tests/e2e/setup.ts. */
async function stageAgentHome(runDir) {
  const source = await getRealAgentDir();
  const agentDir = join(runDir, "agent");
  mkdirSync(agentDir, { mode: 0o700 });
  for (const name of ["auth.json", "models.json", "settings.json", "npm"]) {
    const path = join(source, name);
    if (existsSync(path)) cpSync(path, join(agentDir, name), { recursive: true, mode: constants.COPYFILE_FICLONE });
  }
  return agentDir;
}

// ---------------------------------------------------------------- launching

async function launchApp(runDir, extraEnv = {}) {
  const app = await _electron.launch({
    args: [MAIN_JS, "--user-data-dir", join(runDir, "user-data"), "--remote-allow-origins=*"],
    env: { ...process.env, NODE_ENV: "production", ...extraEnv },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

async function visible(locator, timeoutMs, label) {
  await locator.first().waitFor({ state: "visible", timeout: timeoutMs });
  return label;
}

async function shot(page, name) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path });
  record.evidence[name] = path;
  return path;
}

// ---------------------------------------------------------------- fixtures

/** One isolated agent home containing exactly one session with `entries`
 *  after the session header. Mirrors tests/e2e/helpers.ts. */
async function createAgentHomeFixture(runDir, entries) {
  const agentHome = join(runDir, "fixture-agent");
  const workspace = join(agentHome, "workspace");
  mkdirSync(workspace, { recursive: true });
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

// ---------------------------------------------------------------- cleanup

let currentApp = null;
let currentRunDir = null;
const extraCleanup = [];

async function teardown() {
  if (currentApp) { try { await currentApp.close(); } catch { /* already gone */ } currentApp = null; }
  for (const p of extraCleanup) { try { rmSync(p, { force: true }); } catch { /* best effort */ } }
  if (!keep && currentRunDir) {
    try { rmSync(currentRunDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* best effort */ }
  }
}

process.on("SIGINT", async () => { await teardown(); process.exit(130); });

// ---------------------------------------------------------------- doctor

function newestMtime(dir, best = 0) {
  let result = best;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) result = Math.max(result, newestMtime(p, result));
    else result = Math.max(result, statSync(p).mtimeMs);
  }
  return result;
}

async function doctor() {
  let failures = 0;
  const line = (ok, msg) => { process.stdout.write(`  ${ok ? "[ok]" : "[FAIL]"} ${msg}\n`); if (!ok) failures++; };

  line(existsSync(MAIN_JS), `build output ${MAIN_JS.replace(ROOT + "/", "")} exists (run "npm run build" first if missing)`);
  line(existsSync(join(ROOT, "node_modules", "electron")), "electron dependency installed");
  line(existsSync(join(ROOT, "node_modules", "@playwright", "test")), "@playwright/test installed");

  const agentDir = await getRealAgentDir();
  line(existsSync(agentDir), `agent home ${agentDir} exists`);
  const hasAuth = existsSync(join(agentDir, "auth.json"));
  const hasModels = existsSync(join(agentDir, "models.json"));
  line(hasAuth && hasModels, `auth.json + models.json present (prompt-reply needs them; found auth=${hasAuth} models=${hasModels})`);

  if (existsSync(MAIN_JS)) {
    const srcNewest = Math.max(newestMtime(join(ROOT, "electron")), newestMtime(join(ROOT, "pi-web", "src")));
    const builtAt = statSync(MAIN_JS).mtimeMs;
    if (srcNewest > builtAt) {
      process.stdout.write("  [WARN] sources are newer than the build — run npm run build before driving\n");
    } else {
      process.stdout.write("  [ok] build is fresher than electron/ and pi-web/src/\n");
    }
  }
  record.result = failures === 0 ? "PASS" : "FAIL";
  return failures === 0 ? 0 : 1;
}

// ---------------------------------------------------------------- journeys

async function journeyShell(runDir) {
  const agentDir = await stageAgentHome(runDir);
  const { app, page } = await launchApp(runDir);
  currentApp = app;

  const title = await page.title();
  if (!title.includes("Pi")) throw new VerifyError(`window title ${JSON.stringify(title)} does not contain "Pi"`);
  step("window opens", `title: ${title}`);

  const hasBridge = await page.evaluate(() => typeof window.pi === "object");
  if (!hasBridge) throw new VerifyError("window.pi bridge missing (preload did not load)");
  step("preload bridge exposed", "typeof window.pi === 'object'");

  await visible(page.locator("body"), 10_000, "app shell rendered");
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  if (bodyText.length === 0) throw new VerifyError("app shell rendered no text");
  step("app shell has content", `${bodyText.length} chars of visible text`);

  const list = await page.evaluate(async () => {
    const raw = await window.pi.sessionsList();
    return raw;
  });
  const parsed = typeof list === "string" ? JSON.parse(list) : list;
  if (parsed && parsed.error) throw new VerifyError(`sessionsList error: ${JSON.stringify(parsed.error)}`);
  step("sessions facade answers", `sessionsList returned without error (empty list is expected: ${Array.isArray(parsed?.sessions) ? parsed.sessions.length : "?"} sessions)`);

  await shot(page, "shell");
}

async function journeySessionHistory(runDir) {
  const marker = "HISTORY-PROOF-REPLY-5b1d";
  const first = "history fixture e2e";
  const entries = [
    JSON.stringify({
      type: "message", id: "verify-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: first }] },
    }),
    JSON.stringify({
      type: "message", id: "verify-a1", parentId: "verify-u1", timestamp: "2026-09-08T00:00:02.000Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: `fixture reply ${marker}` }],
        model: "fixture-model", provider: "fixture-provider", usage: { input: 1, output: 1 },
      },
    }),
  ];
  const agentHome = await createAgentHomeFixture(runDir, entries);
  const { app, page } = await launchApp(runDir, { PI_CODING_AGENT_DIR: agentHome });
  currentApp = app;

  // Sidebar lists sessions by first user message; rows are clickable divs.
  const row = page.getByText(first).first();
  await visible(row, 20_000, "session row in sidebar");
  await shot(page, "sidebar-lists-session");
  await row.click();
  step("opened session from sidebar", `clicked the row titled ${JSON.stringify(first)}`);

  await visible(page.getByText(marker).first(), 20_000, "assistant reply rendered from history");
  step("history context rendered", `assistant marker ${marker} visible`);

  const facade = await page.evaluate(async () => {
    const raw = await window.pi.sessionsList();
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  });
  const count = Array.isArray(facade?.sessions) ? facade.sessions.length : -1;
  if (count < 1) throw new VerifyError(`sessionsList shows ${count} sessions; the fixture session is missing`);
  step("facade confirms the session", `sessionsList reports ${count} session(s)`);

  await shot(page, "session-context-loaded");
}

async function journeyBashFullOutput(runDir) {
  const first = "bash fixture e2e";
  const marker = "VERIFY-BASH-FULL-OUTPUT-MARKER-77ce";
  const bashLog = join(tmpdir(), `pi-bash-verify-${STAMP}.log`);
  writeFileSync(bashLog, `head line\n${marker} tail of the full log that the truncated preview omits\n`);
  extraCleanup.push(bashLog);

  const entries = [
    JSON.stringify({
      type: "message", id: "verify-u1", parentId: null, timestamp: "2026-09-08T00:00:01.000Z",
      message: { role: "user", content: [{ type: "text", text: first }] },
    }),
    JSON.stringify({
      type: "message", id: "verify-b1", parentId: "verify-u1", timestamp: "2026-09-08T00:00:02.000Z",
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
  const agentHome = await createAgentHomeFixture(runDir, entries);
  const { app, page } = await launchApp(runDir, { PI_CODING_AGENT_DIR: agentHome });
  currentApp = app;

  const row = page.getByText(first).first();
  await visible(row, 20_000, "session row in sidebar");
  await row.click();
  step("opened session", "fixture session selected");

  // Localized label: the app runs zh-CN by default; keep the en fallback.
  const viewFull = page.getByRole("button", { name: /查看完整输出|View full output/i });
  await visible(viewFull, 20_000, "view-full-output button");
  await viewFull.click();
  step("clicked view full output", "requested the full bash log over IPC (pi:agent:bash-output)");

  const bashHeader = page.getByRole("button", { name: /bash echo fixture-long-output/ });
  await visible(bashHeader, 10_000, "bash tool-call block");
  await bashHeader.click();
  step("expanded the bash block", "collapsed tool-call pane opened");

  await visible(page.getByText(new RegExp(marker)).first(), 10_000, "full log content");
  const failedFetch = await page.getByText(/Failed to fetch/).count();
  if (failedFetch !== 0) throw new VerifyError(`"Failed to fetch" appeared ${failedFetch} time(s) — the dead HTTP call is back`);
  step("full log loaded over IPC", `marker ${marker} visible; no "Failed to fetch"`);

  await shot(page, "bash-full-output-loaded");
}

async function journeyTerminal(runDir) {
  const workspace = join(runDir, "workspace");
  mkdirSync(workspace, { recursive: true });
  const agentDir = await stageAgentHome(runDir);
  const { app, page } = await launchApp(runDir, { PI_CODING_AGENT_DIR: agentDir });
  currentApp = app;

  const result = await page.evaluate(async (workdir) => {
    const collected = [];
    const marker = `verify-${Date.now()}`;
    // Real user path: a terminal belongs to a project. agentNew opens the
    // workspace as a session, which authorizes its cwd as a file root — the
    // shipped journey skipped this and hit the 403.
    const started = await window.pi.agentNew({ cwd: workdir, type: "ensure_session", toolNames: [] });
    if (!started || started.ok !== true) {
      return { ok: false, stage: "agentNew", created: started };
    }
    const created = await window.pi.terminalCreate(workdir, 80, 24, "verify-terminal-1");
    if (created.status !== 200 || created.body.id !== "verify-terminal-1") {
      return { ok: false, stage: "create", created };
    }
    const sub = window.pi.terminalSubscribe("verify-terminal-1", undefined, (frame) => {
      if (frame.event === "output") collected.push(String(frame.data.data));
    });
    const handshake = await sub.ready;
    if (handshake.status !== 200) {
      sub.stop();
      return { ok: false, stage: "subscribe", handshake };
    }
    if (typeof handshake.unsubscribe !== "undefined") {
      sub.stop();
      return { ok: false, stage: "clone-leak", handshake };
    }
    await window.pi.terminalWrite("verify-terminal-1", `echo ${marker}\r`);
    const deadline = Date.now() + 15_000;
    let sawMarker = false;
    while (Date.now() < deadline) {
      if (collected.join("").includes(marker)) { sawMarker = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    sub.stop();
    const killed = await window.pi.terminalKill("verify-terminal-1");
    return { ok: sawMarker && killed.status === 200, stage: "echo", transcript: collected.join("") };
  }, workspace);

  mkdirSync(evidenceDir, { recursive: true });
  const transcriptPath = join(evidenceDir, "terminal-transcript.txt");
  writeFileSync(transcriptPath, result?.transcript ?? "");
  record.evidence.terminalTranscript = transcriptPath;

  if (!result?.ok) throw new VerifyError(`terminal round trip failed at stage ${result?.stage}: ${JSON.stringify(result).slice(0, 400)}`);
  step("PTY round trip", "create → subscribe (replay resolved, no clone leak) → echo marker read from output frames → kill");
  await shot(page, "terminal");
}

async function journeyPromptReply(runDir) {
  const realAgent = await getRealAgentDir();
  if (!existsSync(join(realAgent, "auth.json")) || !existsSync(join(realAgent, "models.json"))) {
    finish("SKIP", "auth.json/models.json missing from the real agent home — the live-LLM journey cannot run");
    return;
  }
  const agentDir = await stageAgentHome(runDir);
  const workspace = join(runDir, "workspace");
  mkdirSync(workspace, { recursive: true });
  const { app, page } = await launchApp(runDir, { PI_CODING_AGENT_DIR: agentDir });
  currentApp = app;

  const marker = "VERIFY_OK_5b1d";
  const created = await page.evaluate(async (cwdArg) => {
    const result = await window.pi.agentNew({ cwd: cwdArg, type: "ensure_session", toolNames: [] });
    return result.ok ? result.data : null;
  }, workspace);
  if (!created?.sessionId) throw new VerifyError(`agentNew returned no sessionId: ${JSON.stringify(created).slice(0, 300)}`);
  const sid = created.sessionId;
  step("session created", `sessionId ${sid}`);

  const prompted = await page.evaluate(async ([sidArg, message]) => {
    const r = await window.pi.agentCommand(sidArg, { type: "prompt", message });
    return r.ok;
  }, [sid, `Reply with exactly: ${marker}`]);
  if (!prompted) throw new VerifyError("agentCommand prompt was rejected");
  step("prompt sent", `"Reply with exactly: ${marker}"`);

  const settled = await page.evaluate(async (sidArg) => {
    for (let i = 0; i < 120; i++) {
      const r = await window.pi.agentCommand(sidArg, { type: "get_state" });
      const st = r.ok ? r.data : null;
      if (st && !st.isStreaming && !st.isPromptRunning) return true;
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  }, sid);
  if (!settled) throw new VerifyError("agent run did not settle within 60s");
  step("run settled", "isStreaming and isPromptRunning both false");

  const reply = await page.evaluate(async (sidArg) => {
    const r = await window.pi.agentCommand(sidArg, { type: "get_last_assistant_text" });
    return r.ok ? String(r.data.text) : null;
  }, sid);
  if (!(reply ?? "").includes(marker)) throw new VerifyError(`reply ${JSON.stringify(reply?.slice(0, 200))} does not contain ${marker}`);
  step("reply contains marker", `assistant said: ${JSON.stringify(reply.slice(0, 120))}`);

  // Side effect: the session file must exist in the isolated agent home.
  const sessionsDir = join(agentDir, "sessions");
  const files = existsSync(sessionsDir) ? readdirSync(sessionsDir, { recursive: true }).filter((f) => String(f).endsWith(".jsonl")) : [];
  if (files.length === 0) throw new VerifyError(`no session .jsonl written under ${sessionsDir}`);
  step("session persisted", `${files.length} session file(s) under the isolated agent home`);

  await shot(page, "prompt-reply");
}

// ---------------------------------------------------------------- main

const JOURNEYS = {
  doctor,
  shell: journeyShell,
  "session-history": journeySessionHistory,
  "bash-full-output": journeyBashFullOutput,
  terminal: journeyTerminal,
  "prompt-reply": journeyPromptReply,
};

if (!command || !JOURNEYS[command]) {
  process.stderr.write(`usage: node .claude/skills/verify-pi-agent-app/scripts/drive.mjs <${Object.keys(JOURNEYS).join("|")}> [--keep] [--evidence-dir <dir>]\n`);
  process.exit(2);
}

try {
  if (command === "doctor") {
    process.stdout.write(`doctor:\n`);
    const code = await doctor();
    await writeFacts();
    process.exit(code);
  }
  const runDir = mkdtempSync(join(tmpdir(), "pi-verify-"));
  currentRunDir = runDir;
  process.stdout.write(`journey: ${command}\nrun dir: ${runDir}\nevidence: ${evidenceDir}\n`);
  try {
    await JOURNEYS[command](runDir);
  } catch (error) {
    finish("FAIL", error instanceof Error ? error.message : String(error));
  } finally {
    await teardown();
  }
  await writeFacts();
  process.stdout.write(`${record.result}${record.note ? ` — ${record.note}` : ""}\nevidence: ${evidenceDir}/facts.json\n`);
  process.exit(record.result === "PASS" ? 0 : record.result === "SKIP" ? 3 : 1);
} catch (fatal) {
  finish("FAIL", `fatal: ${fatal instanceof Error ? (fatal.stack ?? fatal.message) : String(fatal)}`);
  await teardown();
  await writeFacts();
  process.stderr.write(`${record.note}\n`);
  process.exit(1);
}
