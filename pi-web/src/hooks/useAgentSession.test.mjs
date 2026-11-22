import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Transport guard: upstream ships forkIntoCwd as a POST /api/sessions/[id]/fork
// `{ cwd }` fetch (029e5896/#1699). A clean three-way merge carried that fetch
// into this hook verbatim, and under file:// the whole missing-folder Fork
// entry point died with "Failed to fetch" (found in review after the v0.18.0
// sync). The flow must ride the typed bridge, like every other fork transport.
const source = await readFile(new URL("./useAgentSession.ts", import.meta.url), "utf8");

test("forking a session into another folder rides the sessions:fork IPC, never a bare /api fetch", () => {
  const fn = source.slice(
    source.indexOf("const forkIntoCwd = useCallback"),
    source.indexOf("const canForkMissingCwd"),
  );
  assert.ok(fn, "forkIntoCwd not found where the guard expects it");
  assert.doesNotMatch(fn, /fetch\([`"']\/api\//);
  assert.match(fn, /window\.pi\.sessionsFork\(sid, \{ cwd \}\)/);
  // The IPC answers { status, body }; the refusal path reads both like the route's.
  assert.match(fn, /res\.status !== 200/);
  assert.match(fn, /forkFailureMessage\(data\.code/);
});
