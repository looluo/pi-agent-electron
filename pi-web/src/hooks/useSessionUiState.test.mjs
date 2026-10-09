import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";

// The hook runs against the React stand-in and a scripted fetch: each request
// takes the next answer in line.
const shimPath = fileURLToPath(new URL("./__fixtures__/react-hook-shim.mjs", import.meta.url));
const jiti = createJiti(import.meta.url, { tsconfigPaths: true, alias: { react: shimPath } });
// Windows: a dynamic import takes a URL, never a bare drive-letter path.
const { renderHook } = await import(pathToFileURL(shimPath).href);
const { useSessionUiState } = await jiti.import("./useSessionUiState.ts");

const answers = [];
const requests = [];
const asBody = (result) => (typeof result?.json === "function" ? result.json() : Promise.reject(result));
// Fork: the hook rides the sessionUiState IPC; the scripted transport keeps
// upstream's request/error semantics (JSON bodies, Response-like answers).
globalThis.window = { pi: { sessionUiStateGet: async () => {
  requests.push({ url: "ui-state", method: "GET" });
  const answer = answers.shift();
  if (!answer) throw new Error("no answer scripted for GET");
  return Promise.resolve(answer()).then(asBody, (rejection) => Promise.reject(rejection));
}, sessionUiStatePost: async (request) => {
  requests.push({ url: "ui-state", method: "POST", body: request });
  const answer = answers.shift();
  if (!answer) throw new Error("no answer scripted for POST");
  return Promise.resolve(answer()).then(asBody, (rejection) => Promise.reject(rejection));
} } };

const json = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const served = (state) => json(200, { state });
const refused = (status, error) => json(status, { error });
const offline = () => () => Promise.reject(new TypeError("fetch failed"));
const uiState = (revision, extra = {}) => ({ version: 1, revision, sessions: {}, projects: {}, ...extra });

/** Lets the scripted fetches and their JSON bodies resolve, then renders what they set. */
async function settle(hook) {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setImmediate(resolve));
  hook.flush();
}

const mounted = [];
test.afterEach(() => {
  for (const hook of mounted.splice(0)) hook.unmount();
  assert.equal(answers.length, 0, "every scripted answer was used");
  requests.length = 0;
});

function render() {
  const hook = renderHook(useSessionUiState);
  mounted.push(hook);
  return hook;
}

test("a failed first GET settles loaded but not synced; a write response syncs it for good", async () => {
  answers.push(refused(500, "disk on fire"));
  const hook = render();
  await settle(hook);
  assert.equal(hook.result.loaded, true);
  assert.equal(hook.result.synced, false, "an empty local state is no server state");
  assert.equal(hook.result.error, "disk on fire");

  // An accepted write adopts the server's answer: synced.
  answers.push(served(uiState(4, { projectOrder: ["/new", "/old"] })));
  const write = hook.result.apply({ action: "add-projects", keys: ["/new"] });
  hook.flush();
  assert.deepEqual(hook.result.state.projectOrder, ["/new"], "applied at once");
  assert.equal(hook.result.synced, false, "not before the server answered");
  assert.equal(await write, true);
  hook.flush();
  assert.equal(hook.result.synced, true);
  assert.equal(hook.result.error, null);
  assert.deepEqual(hook.result.state.projectOrder, ["/new", "/old"]);

  // A refused write whose rollback GET fails too, then a failed refresh: synced stays.
  answers.push(refused(400, "nope"), offline());
  assert.equal(await hook.result.apply({ action: "move-project", projectKey: "/old", anchorKey: "/new", position: "before", add: [] }), false);
  hook.flush();
  assert.equal(hook.result.synced, true);
  assert.equal(hook.result.error, "fetch failed");
  answers.push(offline());
  hook.result.noteRevision(9);
  await settle(hook);
  assert.equal(hook.result.synced, true);
  assert.deepEqual(requests.map(({ method }) => method), ["GET", "POST", "POST", "GET", "GET"]);
});

test("a successful first GET sets loaded and synced together and adopts the server's state", async () => {
  answers.push(served(uiState(2, { projectOrder: ["/b", "/a"] })));
  const hook = render();
  assert.equal(hook.result.loaded, false);
  assert.equal(hook.result.synced, false);
  await settle(hook);
  assert.equal(hook.result.loaded, true);
  assert.equal(hook.result.synced, true);
  assert.equal(hook.result.error, null);
  assert.deepEqual(hook.result.state.projectOrder, ["/b", "/a"]);

  // A later GET that fails keeps both, and the state it had.
  answers.push(refused(503, "busy"));
  hook.result.noteRevision(3);
  await settle(hook);
  assert.equal(hook.result.loaded, true);
  assert.equal(hook.result.synced, true);
  assert.equal(hook.result.error, "busy");
  assert.deepEqual(hook.result.state.projectOrder, ["/b", "/a"]);
});
