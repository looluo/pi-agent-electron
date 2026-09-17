import assert from "node:assert/strict";
import test from "node:test";

import {
  isProcessGroupExpanded,
  setProcessGroupExpanded,
} from "./process-group-expansion.ts";

function installWindow() {
  const store = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  };
  return store;
}

test("defaults to collapsed when nothing is remembered for the session", () => {
  installWindow();
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), false);
});

test("persists expansion per session and survives reads across calls", () => {
  installWindow();
  setProcessGroupExpanded("s1", "anchor-1", true);
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), true);
  // Other sessions and other anchors are unaffected.
  assert.equal(isProcessGroupExpanded("s1", "anchor-2"), false);
  assert.equal(isProcessGroupExpanded("s2", "anchor-1"), false);
});

test("collapsing again removes the record", () => {
  installWindow();
  setProcessGroupExpanded("s1", "anchor-1", true);
  setProcessGroupExpanded("s1", "anchor-1", false);
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), false);
});

test("caps remembered ids (FIFO eviction) to bound storage growth", () => {
  installWindow();
  for (let i = 0; i < 230; i++) setProcessGroupExpanded("s1", `a${i}`, true);
  assert.equal(isProcessGroupExpanded("s1", "a0"), false);
  assert.equal(isProcessGroupExpanded("s1", "a29"), false);
  assert.equal(isProcessGroupExpanded("s1", "a30"), true);
  assert.equal(isProcessGroupExpanded("s1", "a229"), true);
});

test("corrupted storage falls back to collapsed instead of throwing", () => {
  const store = installWindow();
  store.set("pi-process-groups:s1", "{not json");
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), false);
  setProcessGroupExpanded("s1", "anchor-1", true);
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), true);
});

test("non-string entries in storage are ignored", () => {
  const store = installWindow();
  store.set("pi-process-groups:s1", JSON.stringify([42, null, "anchor-1"]));
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), true);
  assert.equal(isProcessGroupExpanded("s1", "42"), false);
});

test("without window (SSR / storage unavailable) degrades silently", () => {
  delete globalThis.window;
  assert.equal(isProcessGroupExpanded("s1", "anchor-1"), false);
  assert.doesNotThrow(() => setProcessGroupExpanded("s1", "anchor-1", true));
});
