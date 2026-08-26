import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The production renderer is file://-loaded (loadFile), where an absolute
// "/asset.svg" resolves to the filesystem root and silently fails to load.
// Sprite/icon references must stay document-relative.

test("provider icons reference the sprite with a relative path", async () => {
  const source = await readFile(new URL("./ProviderIcon.tsx", import.meta.url), "utf8");

  assert.match(source, /href=\{`provider-icons\.svg#/);
  assert.doesNotMatch(source, /["'`]\/provider-icons\.svg/);
});

test("catppuccin file icons use a document-relative icons root", async () => {
  const source = await readFile(new URL("./FileIcons.tsx", import.meta.url), "utf8");

  assert.match(source, /const CATPPUCCIN_ICONS_ROOT = "icons\/catppuccin"/);
  assert.doesNotMatch(source, /"\/icons\/catppuccin/);
});
