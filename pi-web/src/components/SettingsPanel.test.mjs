import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssSource = await readFile(new URL("../settings.css", import.meta.url), "utf8");

test("the trust dialog Settings › MCP opens stacks above Settings", () => {
  const zIndex = (selector) => Number(cssSource.match(new RegExp(`\\${selector} \\{[^}]*z-index: (\\d+);`))?.[1]);
  assert.ok(zIndex(".project-trust-backdrop") > zIndex(".settings-dialog-backdrop"));
});


test("the cache-miss switch reads and writes over the typed IPC, never a bare /api fetch", async () => {
  // The Electron renderer has no HTTP origin (file://): upstream 653cd7c's
  // fetch("/api/cache-miss-notices") surfaced as "Failed to fetch" until
  // re-homed onto pi:settings:cache-miss-notices.
  const source = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\([`"']\/api\/cache-miss-notices/);
  assert.match(source, /window\.pi\.cacheMissNoticesGet\(\)/);
  assert.match(source, /window\.pi\.cacheMissNoticesPut\(enabled\)/);
});
