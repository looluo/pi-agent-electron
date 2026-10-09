import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../globals.css", import.meta.url), "utf8");

/** The resolved stack: `--font-mono` may point at `--font-mono-default`. */
function resolvedMonoStack(source) {
  const mono = source.match(/--font-mono:\s*([^;]+);/)?.[1]?.trim();
  assert.ok(mono, "global monospace stack must be defined");
  if (!mono.startsWith("var(")) return mono;
  const name = mono.slice(4, -1).trim();
  const stack = source.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];
  assert.ok(stack, `${name} must be defined`);
  return stack;
}

test("the code font stack has explicit macOS fallbacks and no proportional candidates", () => {
  const stack = resolvedMonoStack(css);
  assert.match(stack, /Menlo, Monaco, Consolas/);
  assert.match(stack, /monospace$/);
  assert.doesNotMatch(stack, /PingFang|Microsoft YaHei|ui-monospace|var\(/);
});
