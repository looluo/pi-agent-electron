import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Port of agegr/pi-web PR #45 (automatic session titles, never accepted
// upstream). The port reshapes the PR to share the manual auto-name path pi-web
// shipped later: the automatic call rides `pi:sessions:auto-name` with a
// skipIfNamed guard instead of the PR's separate generate-title route.
const source = await readFile(new URL("./useAgentSession.ts", import.meta.url), "utf8");
const chatWindowSource = await readFile(new URL("../components/ChatWindow.tsx", import.meta.url), "utf8");
const appShellSource = await readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../../../electron/main/services/sessions.ts", import.meta.url), "utf8");
const ipcSource = await readFile(new URL("../../../electron/main/ipc.ts", import.meta.url), "utf8");
const preloadSource = await readFile(new URL("../../../electron/preload/index.ts", import.meta.url), "utf8");

test("automatic naming rides the manual auto-name IPC with a skip-if-named guard", () => {
  const autoNameSource = serviceSource.slice(
    serviceSource.indexOf("export async function sessionsAutoName"),
    serviceSource.indexOf("/** Port of app/api/sessions/[id]/entries"),
  );

  // One shared generation path: the manual flow is not duplicated for the automatic call.
  assert.match(autoNameSource, /options: \{ skipIfNamed\?: boolean \} = \{\}/);
  assert.match(autoNameSource, /if \(options\.skipIfNamed\)/);
  assert.match(autoNameSource, /getSessionName\(\)/);
  assert.match(autoNameSource, /skipped: true as const, title: currentName/);
  // skipIfNamed returns before startRpcSession, so a named session never spins one up.
  assert.ok(
    autoNameSource.indexOf("skipped: true as const, title: currentName")
      < autoNameSource.indexOf("startRpcSession"),
  );
  assert.match(autoNameSource, /generateSessionTitle\(session\.inner/);
  assert.match(
    ipcSource,
    /"pi:sessions:auto-name", \(_e, id: string, options\?: \{ skipIfNamed\?: boolean \}\) => guard\(\(\) => sessionsAutoName\(id, options\)\)\)/,
  );
  assert.match(
    preloadSource,
    /sessionsAutoName: \(id: string, options\?: \{ skipIfNamed\?: boolean \}\) => ipcRenderer\.invoke\("pi:sessions:auto-name", id, options\)/,
  );
});

test("agent completion triggers silent title generation for unnamed sessions", () => {
  const maybeSource = source.slice(
    source.indexOf("const maybeAutoNameSession = useCallback"),
    source.indexOf("const scheduleEventStreamClose = useCallback"),
  );
  const finishSource = source.slice(
    source.indexOf("const finishPromptWithoutStream"),
    source.indexOf("const waitForPromptSettlement"),
  );
  const settledSource = source.slice(
    source.indexOf('case "agent_settled"'),
    source.indexOf('case "prompt_done"'),
  );
  const promptDoneSource = source.slice(
    source.indexOf('case "prompt_done"'),
    source.indexOf('case "prompt_error"'),
  );

  assert.match(maybeSource, /window\.pi\.sessionsAutoName\(sid, \{ skipIfNamed: true \}\)/);
  // Silent by design: failures never surface (PR #45 behavior).
  assert.match(maybeSource, /\.catch\(\(\) => null\)/);
  assert.match(maybeSource, /session\?\.name/);
  assert.match(maybeSource, /onTitleGenerated\?\.\(sid, title\.trim\(\)\)/);
  // Concurrent runs of the same session collapse into one generation.
  assert.match(maybeSource, /autoNameInFlightRef\.current === sid/);
  // Subagent sessions keep their run-metadata identity, never a chat title.
  assert.match(maybeSource, /session\?\.relation\?\.kind === "subagent"/);

  // Fires exactly where the SDK agent (not a bare prompt) is known to have settled.
  assert.match(
    finishSource,
    /agentWasActive && wasRunning\) \{\s*onAgentEnd\?\.\(\);\s*maybeAutoNameSession\(\);/,
  );
  assert.match(
    settledSource,
    /if \(wasRunning\) \{\s*onAgentEnd\?\.\(\);\s*maybeAutoNameSession\(\);/,
  );
  // Bare prompts (slash commands without an agent run) never trigger a title.
  assert.doesNotMatch(promptDoneSource, /maybeAutoNameSession/);
  assert.doesNotMatch(promptDoneSource, /onTitleGenerated/);
});

test("generated titles refresh the sidebar without the manual naming status", () => {
  const titleSource = appShellSource.slice(
    appShellSource.indexOf("  const handleTitleGenerated = useCallback"),
    appShellSource.indexOf("  const handleExplorerRefresh = useCallback"),
  );

  assert.match(titleSource, /setRefreshKey\(\(key\) => key \+ 1\)/);
  assert.match(titleSource, /activeSessionIdRef\.current !== sessionId/);
  assert.match(titleSource, /name: title/);
  assert.match(titleSource, /sessionName: title/);
  // Silent path: no autoNameStatus transitions on automatic generation.
  assert.doesNotMatch(titleSource, /setAutoNameStatus/);
  assert.match(appShellSource, /onTitleGenerated=\{handleTitleGenerated\}/);
  assert.match(chatWindowSource, /onTitleGenerated, onAttentionNeeded/);
  assert.match(chatWindowSource, /onAgentEnd: wrappedOnAgentEnd, onTitleGenerated/);
});
