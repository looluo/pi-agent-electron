// Anchor rollback for the initial session window: when tail slicing opens
// mid-turn, the window head has no user-message anchor and ChatWindow renders
// it flat (no "process details" group to collapse). buildSessionContext must
// extend backward to the nearest turn anchor — bounded, and skipped on
// pagination-style calls.
import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { buildSessionContext, ANCHOR_ROLLBACK_CAP } = await jiti.import("./session-reader.ts");

// Long single turn: user message at e0, then assistant/toolResult messages up
// to e(n-1). A tail window inside this turn starts with no anchor in sight.
function longTurn(total) {
  const entries = [];
  for (let i = 0; i < total; i++) {
    const role = i === 0 ? "user" : i % 2 === 1 ? "assistant" : "toolResult";
    entries.push({
      id: `e${i}`,
      parentId: i === 0 ? null : `e${i - 1}`,
      type: "message",
      timestamp: new Date(1000 + i * 1000).toISOString(),
      message: { role, content: [{ type: "text", text: `msg ${i}` }] },
    });
  }
  return entries;
}

test("initial window opens mid-turn: rolls back to the turn's user anchor", () => {
  const entries = longTurn(100);
  const ctx = buildSessionContext(entries, "e99", { tail: 10 });
  assert.equal(ctx.entryIds[0], "e0");
  assert.ok(ctx.messages[0].role === "user");
  assert.equal(ctx.entryIds[ctx.entryIds.length - 1], "e99");
  // Window = tail + rollback prefix.
  assert.equal(ctx.entryIds.length, 100);
});

test("window already starts at an anchor: no rollback, no duplication", () => {
  const entries = longTurn(20);
  const ctx = buildSessionContext(entries, "e19", { tail: 20 });
  assert.equal(ctx.entryIds[0], "e0");
  assert.equal(ctx.entryIds.length, 20);
});

test("compaction entries count as turn anchors", () => {
  const entries = longTurn(60);
  entries[30] = {
    id: "e30",
    parentId: "e29",
    type: "compaction",
    timestamp: new Date(31000).toISOString(),
    summary: [{ type: "text", text: "compacted" }],
    tokensBefore: 1000,
    firstKeptEntryId: "e5",
  };
  entries[31].parentId = "e30";
  const ctx = buildSessionContext(entries, "e59", { tail: 10 });
  assert.equal(ctx.entryIds[0], "e30");
  assert.equal(ctx.messages[0].role, "custom");
});

test("anchor farther than the cap: keeps the plain tail window", () => {
  const entries = longTurn(2500); // anchor e0, window would open mid-turn — anchor beyond the cap
  const ctx = buildSessionContext(entries, "e2499", { tail: 10 });
  // Since #810 the tail budget counts visible messages only: the 10th visible
  // (assistant) entry back is e2481; interleaved toolResults ride along as
  // attachments and the out-of-reach anchor keeps the window plain.
  assert.equal(ctx.entryIds[0], "e2481");
  assert.equal(ctx.messages.filter((m) => m.role === "assistant").length, 10);
  assert.equal(ctx.entryIds[ctx.entryIds.length - 1], "e2499");
});

test("real-world mega-turn (541 entries) rolls back within the cap", () => {
  // Shape from the 2026-09-16 user report: active-branch final turn of 541
  // entries, tail-50 window head 491 entries past the anchor.
  const entries = longTurn(600);
  const ctx = buildSessionContext(entries, "e599", { tail: 50 });
  assert.equal(ctx.entryIds[0], "e0");
  assert.equal(ctx.messages[0].role, "user");
});

test("pagination page touching a long turn also rolls back to the anchor", () => {
  // Regression (2026-09-16 user report): while scrolling up, a pagination page
  // used to deliver mid-turn content whose anchor arrived only pages later —
  // the turn rendered flat (expanded-looking) until the anchor page regrouped
  // it collapsed. Pages now extend backward to the anchor too.
  const entries = longTurn(100);
  const page = buildSessionContext(entries, "e70", { tail: 10, excludeLeaf: true });
  assert.equal(page.entryIds[0], "e0");
  assert.equal(page.entryIds[page.entryIds.length - 1], "e69");
  assert.equal(page.messages[0].role, "user");
});

test("pagination page already headed by an anchor does not extend", () => {
  const entries = longTurn(60);
  entries[10].message = { role: "user", content: [{ type: "text", text: "turn 2" }] };
  const page = buildSessionContext(entries, "e20", { tail: 5, excludeLeaf: true });
  // Head e15 is mid-turn-2 → rolls back to anchor e10.
  assert.equal(page.entryIds[0], "e10");
  const next = buildSessionContext(entries, "e10", { tail: 5, excludeLeaf: true });
  // Head e5 is mid-turn-1 → rolls back to anchor e0.
  assert.equal(next.entryIds[0], "e0");
});

test("rollback preserves hasMore and oldestEntryId for further pagination", () => {
  // Two turns: user anchor at e0, second user anchor at e10.
  const entries = longTurn(60);
  entries[10].message = { role: "user", content: [{ type: "text", text: "turn 2" }] };
  const ctx = buildSessionContext(entries, "e59", { tail: 10 });
  assert.equal(ctx.oldestEntryId, "e10");
  assert.equal(ctx.hasMore, true);
  // The next pagination page starts strictly before the anchor — no overlap.
  // Its own head (mid-turn-1) also rolls back, landing on e0; coverage of the
  // in-between entries is preserved (rollback only extends, never skips).
  const page = buildSessionContext(entries, "e10", { tail: 5, excludeLeaf: true });
  assert.equal(page.entryIds[0], "e0");
  assert.deepEqual(
    [...page.entryIds, ...ctx.entryIds],
    entries.map((e) => e.id),
  );
});
