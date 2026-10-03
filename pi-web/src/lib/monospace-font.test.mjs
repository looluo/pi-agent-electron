import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../globals.css", import.meta.url), "utf8");

test("the code font stack has explicit macOS fallbacks and no proportional candidates", () => {
  const stack = css.match(/--font-mono:\s*([^;]+);/)?.[1];
  assert.ok(stack, "global monospace stack must be defined");
  assert.match(stack, /Menlo, Monaco, Consolas/);
  assert.match(stack, /monospace$/);
  assert.doesNotMatch(stack, /PingFang|Microsoft YaHei|ui-monospace|var\(/);
});
