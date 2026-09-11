import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { THEME_INIT_SCRIPT, THEME_OPTIONS, isDarkTheme, isThemePreference } from "./theme.ts";

test("first paint restores every palette and falls back to the system for invalid or blocked storage", () => {
  for (const systemDark of [false, true]) {
    for (const stored of [...THEME_OPTIONS.map(({ id }) => id), null, "", "unknown", new Error("Blocked")]) {
      const root = { dataset: {}, classList: { toggle: (name, value) => { root[name] = value; } } };
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: { getItem: () => { if (stored instanceof Error) throw stored; return stored; } },
        window: { matchMedia: () => ({ matches: systemDark }) },
        document: { documentElement: root },
      });
      const expected = isThemePreference(stored) && stored !== "auto" ? stored : systemDark ? "dark" : "light";
      assert.equal(root.dataset.theme, expected);
      assert.equal(root.dark, isDarkTheme(expected));
    }
  }
});

test("index.html carries the boot theme script in sync with THEME_INIT_SCRIPT", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  const match = /\(function\(\)\{var t="auto";[\s\S]*?\}\)\(\);/.exec(html);
  assert.ok(match, "boot theme script not found in index.html");
  const source = match[0];
  const ids = THEME_OPTIONS.map(({ id }) => id);
  for (const id of ids) assert.ok(source.includes(`"${id}"`), `boot script missing theme id ${id}`);
  assert.match(source, /dataset\.theme=t/);
  assert.match(source, /classList\.toggle\("dark",t==="dark"\|\|t==="pine"\)/);
});
