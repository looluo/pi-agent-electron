import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tabBar = await readFile(new URL("./TabBar.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../globals.css", import.meta.url), "utf8");

test("visible scrollbars share the global 5px dimensions", () => {
  assert.match(css, /(?<![\w.-])::-webkit-scrollbar\s*\{\s*width: 5px;\s*height: 5px;/);
  assert.match(css, /::-webkit-scrollbar-thumb\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.doesNotMatch(css, /scrollbar-width: thin/);
});

// Structural guard for the layout contract. Pixel geometry is verified in
// Chromium with non-overlay scrollbars; DOM-only tests cannot measure that.
test("file tabs reserve a scrollbar lane without shrinking or raising the tab row", () => {
  assert.match(tabBar, /role="tablist"\s+className="file-panel-tab-list"/);
  assert.match(tabBar, /height: "var\(--file-tab-height, 36px\)"/);
  const header = css.match(/\.file-panel-tab-header\s*\{([^}]+)\}/)?.[1];
  assert.ok(header);
  assert.match(header, /--file-tab-height: 36px/);
  assert.match(header, /--file-tab-scrollbar-height: 5px/);
  const list = css.match(/\.file-panel-tab-list\s*\{([^}]+)\}/)?.[1];
  assert.ok(list);
  assert.match(list, /align-items: flex-start/);
  assert.match(list, /overflow-x: auto/);
  assert.match(list, /overflow-y: hidden/);
  assert.match(list, /height: calc\(var\(--file-tab-height, 36px\) \+ var\(--file-tab-scrollbar-height, 5px\)\)/);
  assert.match(css, /\.file-panel-tab-list::-webkit-scrollbar\s*\{\s*height: var\(--file-tab-scrollbar-height, 5px\)/);
});

test("file-panel controls align with the tab row rather than the scrollbar lane", () => {
  const start = shell.indexOf("{/* Right panel tab bar */}");
  assert.notEqual(start, -1);
  const header = shell.slice(start, shell.indexOf("{rightPanelMaximized", start));
  assert.match(header, /className="file-panel-tab-header"/);
  assert.match(header, /alignItems: "flex-start"/);
  assert.match(header, /height: "calc\(var\(--file-tab-height\) \+ var\(--file-tab-scrollbar-height\) \+ env\(safe-area-inset-top\)\)"/);
});
