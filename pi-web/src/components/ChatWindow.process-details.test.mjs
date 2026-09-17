import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("process details default to collapsed even when the turn has no final answer", () => {
  // Turns that end aborted / mid-toolUse used to force-expand their group
  // (defaultExpanded={!finalAnswerMessage}); they now render as a collapsed
  // group header like every completed turn.
  assert.doesNotMatch(source, /defaultExpanded=\{!finalAnswerMessage\}/);
  assert.doesNotMatch(source, /defaultExpanded=\{true\}/);
});

test("process details group expansion is persisted per session", () => {
  assert.match(source, /import \{ isProcessGroupExpanded, setProcessGroupExpanded \} from "@\/lib\/process-group-expansion";/);
  assert.match(
    source,
    /const \[expanded, setExpanded\] = useState\(\(\) => \(\s*persistence \? isProcessGroupExpanded\(persistence\.sessionId, persistence\.anchorId\) : defaultExpanded\s*\)\)/,
  );
  assert.match(
    source,
    /<ProcessDetailsGroup[\s\S]*?persistence=\{session\?\.id \? \{ sessionId: session\.id, anchorId \} : undefined\}/,
  );
});
