// Cross-project file-tab park/restore: switching directories must not
// permanently discard the leaving project's open files — the panel layout is
// parked per project and restored on the switch back (memory only; restart
// starts clean). Same-project worktree moves keep tabs live, as before.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");

const helperSource = source.slice(
  source.indexOf("const switchProjectFileTabs = useCallback"),
  source.indexOf("const handleCwdChange = useCallback"),
);

test("parks the leaving project's tabs with active tab and panel state", () => {
  assert.match(source, /fileTabsByProjectRef = useRef<Map<string, \{ tabs: Tab\[\]; activeFileTabId: string \| null; panelOpen: boolean \}>>/);
  assert.match(helperSource, /fileTabsByProjectRef\.current\.set\(fromKey, \{ tabs: fileTabs, activeFileTabId, panelOpen: rightPanelOpen \}\)/);
});

test("restores the entering project's parked layout, panel state included", () => {
  assert.match(helperSource, /fileTabsByProjectRef\.current\.get\(toKey\)/);
  assert.match(helperSource, /setFileTabs\(parked\.tabs\)/);
  assert.match(helperSource, /setActiveFileTabId\(parked\.activeFileTabId\)/);
  assert.match(helperSource, /setRightPanelOpen\(parked\.panelOpen\)/);
});

test("falls back to the legacy clear when the entering project has no snapshot", () => {
  // Terminal tabs keep the panel mounted; only file/none cases close it.
  assert.match(helperSource, /if \(!parked\) \{\s*setFileTabs\(\[\]\);/);
  assert.match(helperSource, /if \(!activeFileTabId \|\| activeFileTabId\.startsWith\("file:"\)\) \{\s*setActiveFileTabId\(null\);\s*handleRightPanelClose\(\);/);
});

test("both cross-project switch points route through the helper — no bare clears left", () => {
  const cwdChangeSource = source.slice(
    source.indexOf("const handleCwdChange = useCallback"),
    source.indexOf("const handleSelectSession = useCallback"),
  );
  const selectSource = source.slice(
    source.indexOf("const handleSelectSession = useCallback"),
    source.indexOf("const handleAutoName = useCallback"),
  );
  assert.match(cwdChangeSource, /switchProjectFileTabs\(currentProject, newProject\)/);
  assert.match(selectSource, /switchProjectFileTabs\(activeProjectKeyRef\.current, projectKey\)/);
  assert.doesNotMatch(cwdChangeSource, /setFileTabs\(\[\]\)/);
  assert.doesNotMatch(selectSource, /setFileTabs\(\[\]\)/);
});

test("same-project worktree moves still keep tabs (early return untouched)", () => {
  const guardSource = source.slice(
    source.indexOf("const handleCwdChange = useCallback"),
    source.indexOf("const handleSelectSession = useCallback"),
  );
  assert.match(guardSource, /currentProject === newProject/);
  assert.match(guardSource, /Same-project[\s\S]*?worktree switches keep them/);
});
