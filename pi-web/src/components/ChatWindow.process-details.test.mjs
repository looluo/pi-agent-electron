import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("groups the leading segment when the history page starts mid-turn", () => {
  // A turn longer than the initial page loses its anchor, and the old loop
  // flattened every message before the first anchor instead of grouping them.
  assert.match(source, /const hasAnchor = isMessageGroupAnchor\(msg\)/);
  assert.match(source, /if \(!hasAnchor && idx !== 0\)/);
  assert.match(source, /const userIdx = hasAnchor \? idx : -1/);
  assert.match(source, /const groupStartIdx = hasAnchor \? idx : 0/);
  assert.match(source, /if \(hasAnchor\) rendered\.push\(renderMessage\(userIdx\)\)/);
});

test("process details expand by default for turns without a final answer", () => {
  // Upstream semantics (#1011): unanswered turns (aborted, mid-toolUse) start
  // expanded so progress stays visible; answered turns start collapsed. This
  // replaces the local always-collapsed default from 26be91e — the persisted
  // per-session expansion (below) is the surviving local addition.
  assert.match(source, /defaultExpanded=\{!finalAnswerMessage\}/);
});

test("resets process details when the turn gains or loses its final answer", () => {
  // useState only reads defaultExpanded on mount; keying on answer availability
  // makes an answered turn start collapsed even if it first rendered unanswered.
  assert.match(
    source,
    /<ProcessDetailsGroup key=\{finalAnswerMessage \? "answered" : "unanswered"\}[\s\S]*?defaultExpanded=\{!finalAnswerMessage\}/,
  );
});

test("process details group expansion is persisted per session", () => {
  assert.match(source, /import \{ isProcessGroupExpanded, setProcessGroupExpanded \} from "@\/lib\/process-group-expansion";/);
  assert.match(
    source,
    /const \[expanded, setExpanded\] = useState\(\(\) => \(\s*persistence \? isProcessGroupExpanded\(persistence\.sessionId, persistence\.anchorId, defaultExpanded\) : defaultExpanded\s*\)\)/,
  );
  assert.match(
    source,
    /<ProcessDetailsGroup[\s\S]*?persistence=\{session\?\.id \? \{ sessionId: session\.id, anchorId \} : undefined\}/,
  );
});
