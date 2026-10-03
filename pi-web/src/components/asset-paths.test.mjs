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

test("catppuccin file icons resolve the icons root against document.baseURI", async () => {
  const source = await readFile(new URL("./FileIcons.tsx", import.meta.url), "utf8");

  // Chromium resolves a url() substituted from a custom property against the
  // stylesheet that consumes the var() — the built CSS under assets/ — so a
  // bare relative "icons/catppuccin" 404s there, and a literal absolute
  // "/icons/catppuccin" hits the filesystem root under file://. The icons
  // root must be pre-resolved against the document at runtime.
  assert.match(source, /typeof document === "undefined"\n\s*\? "icons\/catppuccin"\n\s*: new URL\("icons\/catppuccin", document\.baseURI\)\.href/);
  assert.doesNotMatch(source, /const CATPPUCCIN_ICONS_ROOT = "(?:\/?icons\/catppuccin)"/);
  assert.match(source, /`url\("\$\{CATPPUCCIN_ICONS_ROOT\}\/latte\/\$\{name\}\.svg"\)`/);
});
