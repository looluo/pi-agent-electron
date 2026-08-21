import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("API key saves do not use ModelRuntime.login's network refresh", async () => {
  const full = await readFile(new URL("../../../electron/main/services/models-auth.ts", import.meta.url), "utf-8");
  const source = full.slice(full.indexOf("export async function apiKeySet"), full.indexOf("export async function apiKeyDelete"));

  assert.doesNotMatch(source, /modelRuntime\.login\(/);
  assert.match(source, /apiKeyAuth\.login\(/);
  assert.match(source, /signal:\s*new AbortController\(\)\.signal/);
  assert.match(source, /storeProviderCredential\(provider, credential\)/);
});
