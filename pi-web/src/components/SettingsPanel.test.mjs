import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssSource = await readFile(new URL("../settings.css", import.meta.url), "utf8");

test("the trust dialog Settings › MCP opens stacks above Settings", () => {
  const zIndex = (selector) => Number(cssSource.match(new RegExp(`\\${selector} \\{[^}]*z-index: (\\d+);`))?.[1]);
  assert.ok(zIndex(".project-trust-backdrop") > zIndex(".settings-dialog-backdrop"));
});


test("Settings General switches read and write over typed IPC, never bare /api fetches", async () => {
  // The Electron renderer has no HTTP origin (file://): notices, queue-modes,
  // tools/settings, and http-proxy must all go through window.pi.* IPC.
  const panelSource = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(panelSource, /fetch\([`"']\/api\/(notices|queue-modes|tools\/settings|cache-miss-notices)/);
  assert.match(panelSource, /window\.pi\.noticesGet\(\)/);
  assert.match(panelSource, /window\.pi\.noticesPut\(/);
  assert.match(panelSource, /window\.pi\.queueModesGet\(\)/);
  assert.match(panelSource, /window\.pi\.queueModesPut\(/);
  assert.match(panelSource, /window\.pi\.toolsSettingsGet\(\)/);
  assert.match(panelSource, /window\.pi\.toolsSettingsPut\(/);

  const proxySource = await readFile(new URL("./HttpProxyForm.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(proxySource, /fetch\([`"']\/api\/http-proxy/);
  assert.match(proxySource, /window\.pi\.httpProxyGet\(\)/);
  assert.match(proxySource, /window\.pi\.httpProxyPut\(/);
});

test("signing out removes the stored drafts once the server signed out", async () => {
  // The fork carries the web-auth sign-out block inert (webAuthEnabled stays
  // false under file://); the draft clearing rides it either way.
  const panelSource = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
  assert.match(
    panelSource,
    /if \(!response\.ok\) throw new Error\([^\n]*\);\n(?:\s*\/\/[^\n]*\n)*\s*clearStoredDrafts\(\);\n\s*window\.location\.replace\("\/login"\);/,
  );
});
