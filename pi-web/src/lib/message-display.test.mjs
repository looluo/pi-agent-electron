import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./message-display.ts");
}

function assistant(content) {
  return {
    role: "assistant",
    provider: "test",
    model: "test-model",
    content,
  };
}

test("bounds thinking previews to the first nonblank line without splitting Unicode characters", async () => {
  const { getThinkingPreview } = await loadSubject();
  assert.equal(getThinkingPreview(" \r\n **First line** \r\nSecond line"), "**First line**");
  assert.equal(getThinkingPreview("First\rSecond"), "First");
  assert.equal(getThinkingPreview(" \n\t"), "");
  assert.equal(getThinkingPreview("\u{1F4A1}".repeat(300)), "\u{1F4A1}".repeat(240));
});

// The text back from its pieces: a line break cut left its "\n" out.
function joinPieces(pieces) {
  return pieces.map(({ text, lineBreak }) => (lineBreak ? `${text}\n` : text)).join("");
}

test("cuts long thinking into pieces that join back and stay put while it streams (#1196)", async () => {
  const { THINKING_PIECE_CHARS: P, splitThinkingPieces } = await loadSubject();
  const shapes = [
    "Wait, let me reconsider the config path.\n",
    "等等，我需要重新检查一下。\n\n",
    "a\r\nb\n\n\nc ",
    "\n",
    // No line break: hard cuts, from the second one on landing inside a surrogate pair.
    "Wait, let me reconsider the config path. ",
    "等等，我需要重新检查一下。",
    "a\u{1F4A1}",
    // A line break right at the hard cut, and line breaks past it.
    `${"x".repeat(2 * P)}\n`,
    `${"y".repeat(3 * P)}\n`,
  ];
  for (const unit of shapes) {
    const full = unit.repeat(Math.ceil((P * 7) / unit.length));
    let previous = [];
    // Prefixes in chunks of 1 to 37 characters, as deltas arrive.
    for (let end = 1, step = 0; end <= full.length; end += 1 + (step++ % 37)) {
      const text = full.slice(0, end);
      const pieces = splitThinkingPieces(text);
      assert.equal(joinPieces(pieces), text);
      // Streaming appends: every piece but the last keeps its text.
      assert.deepEqual(pieces.slice(0, previous.length - 1), previous.slice(0, -1));
      pieces.slice(0, -1).forEach((piece, index) => {
        const next = pieces[index + 1].text;
        assert.ok(piece.text.length >= P && piece.text.length <= 2 * P);
        // The first line break past P is the cut, if it comes by the hard cut,
        // unless it ends an empty line: then the piece would end in a line
        // break, which a block does not draw.
        for (const { index } of piece.text.matchAll(/\n/g)) {
          if (index >= P) assert.match(piece.text.slice(0, index), /\n\r?$/);
        }
        if (piece.lineBreak) assert.doesNotMatch(piece.text, /\n\r?$/);
        else {
          assert.ok(piece.text.length >= 2 * P - 1);
          if (next.startsWith("\n")) assert.match(piece.text, /\n\r?$/);
        }
        assert.ok(!/[\uD800-\uDBFF]$/.test(piece.text) && !/^[\uDC00-\uDFFF]/.test(next));
      });
      assert.equal(pieces.at(-1).lineBreak, false);
      assert.notEqual(pieces.at(-1).text, "");
      previous = pieces;
    }
    assert.ok(previous.length >= 4, `${JSON.stringify(unit.slice(0, 20))} gave ${previous.length} pieces`);
  }
});

test("keeps thinking that fits one piece as one, and hard-cuts an unbroken line", async () => {
  const { THINKING_PIECE_CHARS: P, splitThinkingPieces } = await loadSubject();
  const fits = "line\n".repeat(P / 5);
  assert.equal(fits.length, P);
  assert.deepEqual(splitThinkingPieces(fits), [{ text: fits, lineBreak: false }]);
  assert.deepEqual(splitThinkingPieces(""), [{ text: "", lineBreak: false }]);

  const oneLine = "x".repeat(P * 3);
  assert.deepEqual(splitThinkingPieces(oneLine), [
    { text: "x".repeat(2 * P), lineBreak: false },
    { text: "x".repeat(P), lineBreak: false },
  ]);
  // A line break only at the very end leaves nothing after it to cut off.
  assert.deepEqual(splitThinkingPieces(`${oneLine}\n`).at(-1), { text: `${"x".repeat(P)}\n`, lineBreak: false });
  // A line break right at the hard cut is a line break cut.
  assert.deepEqual(splitThinkingPieces(`${"x".repeat(2 * P)}\ny`), [
    { text: "x".repeat(2 * P), lineBreak: true },
    { text: "y", lineBreak: false },
  ]);
  // A line break that ends an empty line is no cut: the piece would end in a
  // line break, which a block does not draw, and lose that empty line.
  const blank = `${"y".repeat(P - 1)}\n\n${"z".repeat(P - 2)}\nw`;
  assert.deepEqual(splitThinkingPieces(blank), [
    { text: `${"y".repeat(P - 1)}\n\n${"z".repeat(P - 2)}`, lineBreak: true },
    { text: "w", lineBreak: false },
  ]);
  const crlf = `${"y".repeat(P - 2)}\r\n\r\nz`;
  assert.deepEqual(splitThinkingPieces(crlf), [{ text: crlf, lineBreak: false }]);
  // A hard cut that would split a surrogate pair goes one code unit earlier.
  const emoji = `a${"\u{1F4A1}".repeat(2 * P)}`;
  assert.deepEqual(splitThinkingPieces(emoji).map(({ text }) => text.length), [2 * P - 1, 2 * P, 2]);
});

test("splits trailing final answer blocks from process blocks", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "thinking", thinking: "work through it" },
    { type: "toolCall", toolCallId: "call-1", toolName: "bash", input: {} },
    { type: "text", text: "Final answer" },
    { type: "image", source: { type: "url", url: "https://example.com/final.png" } },
  ]);

  const result = splitFinalAssistantBlocks(message, { isStreaming: false });

  assert.deepEqual(result.answerBlocks.map((block) => block.type), ["text", "image"]);
  assert.deepEqual(result.processBlocks.map((block) => block.type), ["thinking", "toolCall"]);
});

test("keeps pre-tool text in process blocks", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "text", text: "I will inspect the repo first." },
    { type: "toolCall", toolCallId: "call-1", toolName: "bash", input: {} },
    { type: "text", text: "Final answer" },
  ]);

  const result = splitFinalAssistantBlocks(message, { isStreaming: false });

  assert.deepEqual(result.answerBlocks.map((block) => block.type), ["text"]);
  assert.equal(result.answerBlocks[0].text, "Final answer");
  assert.deepEqual(result.processBlocks.map((block) => block.type), ["text", "toolCall"]);
});

test("does not expose text before a trailing tool call as final answer", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "thinking", thinking: "work through it" },
    { type: "text", text: "I need to call a tool." },
    { type: "toolCall", toolCallId: "call-1", toolName: "bash", input: {} },
  ]);

  const result = splitFinalAssistantBlocks(message, { isStreaming: false });
  assert.deepEqual(result.answerBlocks, []);
  assert.deepEqual(result.processBlocks.map((block) => block.type), ["thinking", "text", "toolCall"]);
});

test("keeps the answer text before a trailing non-pi tool call (extension memory_write)", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  // pi-memory's shape: the summary and the memory_write share one message, the
  // call after the text — the text stays the answer so the fold keeps it open.
  const message = assistant([
    { type: "thinking", thinking: "wrap up" },
    { type: "text", text: "克隆成功，根因与修复……" },
    { type: "toolCall", toolCallId: "call-m", toolName: "memory_write", input: {} },
  ]);

  const result = splitFinalAssistantBlocks(message, { isStreaming: false });
  assert.deepEqual(result.answerBlocks.map((block) => block.type || block.toolName), ["text", "toolCall"]);
  assert.equal(result.answerBlocks[0].text, "克隆成功，根因与修复……");
  assert.deepEqual(result.processBlocks.map((block) => block.type), ["thinking"]);
});

test("a trailing run of non-pi calls is skipped together, a pi call between them still splits", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "text", text: "Summary" },
    { type: "toolCall", toolCallId: "c1", toolName: "memory_write", input: {} },
    { type: "toolCall", toolCallId: "c2", toolName: "mcp_docs_search", input: {} },
  ]);
  assert.deepEqual((await loadSubject()).splitFinalAssistantBlocks(message).answerBlocks.map((b) => b.type === "text" ? "text:" + b.text : b.toolName), ["text:Summary", "memory_write", "mcp_docs_search"]);

  const withPiWork = assistant([
    { type: "text", text: "Summary" },
    { type: "toolCall", toolCallId: "c1", toolName: "memory_write", input: {} },
    { type: "toolCall", toolCallId: "c2", toolName: "bash", input: {} },
  ]);
  assert.deepEqual((await loadSubject()).splitFinalAssistantBlocks(withPiWork).answerBlocks, []);
});

test("drops empty thinking blocks after completion", async () => {
  const { getDisplayableAssistantBlocks, splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "thinking", thinking: "" },
    { type: "text", text: "Final answer" },
  ]);

  assert.deepEqual(
    getDisplayableAssistantBlocks(message, { isStreaming: false }).map((block) => block.type),
    ["text"],
  );

  const result = splitFinalAssistantBlocks(message, { isStreaming: false });
  assert.deepEqual(result.answerBlocks.map((block) => block.type), ["text"]);
  assert.deepEqual(result.processBlocks, []);
});

test("keeps empty thinking while streaming", async () => {
  const { splitFinalAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "thinking", thinking: "" },
    { type: "text", text: "Partial answer" },
  ]);

  const result = splitFinalAssistantBlocks(message, { isStreaming: true });

  assert.deepEqual(result.answerBlocks.map((block) => block.type), ["text"]);
  assert.deepEqual(result.processBlocks.map((block) => block.type), ["thinking"]);
});

test("keeps deferred historical thinking placeholders", async () => {
  const { getDisplayableAssistantBlocks } = await loadSubject();
  const message = assistant([
    { type: "thinking", thinking: "", deferred: true },
    { type: "text", text: "Final answer" },
  ]);

  assert.deepEqual(
    getDisplayableAssistantBlocks(message, { isStreaming: false }).map((block) => block.type),
    ["thinking", "text"],
  );
});


test("returns completed provider errors even when the message has no content", async () => {
  const { getAssistantErrorMessage } = await loadSubject();
  const message = {
    ...assistant([]),
    stopReason: "error",
    errorMessage: "OpenAI API error (403): request forbidden",
  };

  assert.equal(
    getAssistantErrorMessage(message),
    "OpenAI API error (403): request forbidden",
  );
  assert.equal(getAssistantErrorMessage(message, { isStreaming: true }), null);
});

test("falls back when a provider error has no message", async () => {
  const { getAssistantErrorMessage } = await loadSubject();

  assert.equal(
    getAssistantErrorMessage({ ...assistant([]), stopReason: "error" }),
    "Unknown provider error",
  );
  assert.equal(
    getAssistantErrorMessage({ ...assistant([]), stopReason: "stop" }),
    null,
  );
});

test("treats compaction summaries as turn anchors", async () => {
  const { isMessageGroupAnchor } = await loadSubject();

  assert.equal(isMessageGroupAnchor({ role: "user", content: "prompt" }), true);
  assert.equal(isMessageGroupAnchor({
    role: "custom",
    customType: "compaction",
    content: "summary",
    display: true,
  }), true);
  assert.equal(isMessageGroupAnchor(assistant([])), false);
});

test("treats a background subagent completion as a turn anchor", async () => {
  const { isMessageGroupAnchor } = await loadSubject();

  assert.equal(isMessageGroupAnchor({
    role: "custom",
    customType: "pi-web:subagent-notification",
    content: "Subagent child completed.\n\nParser found",
    display: true,
  }), true);
  assert.equal(isMessageGroupAnchor({
    role: "custom",
    customType: "extension_debug",
    content: "hidden extension payload",
    display: false,
  }), false);
});

test("treats @tintinweb/pi-subagents' completion notification as a turn anchor (#1075)", async () => {
  const { isMessageGroupAnchor } = await loadSubject();
  // Sent as a follow-up that triggers a turn; without the anchor that turn's
  // reply became the final answer and folded the earlier one into Process details.
  assert.equal(isMessageGroupAnchor({
    role: "custom",
    customType: "subagent-notification",
    content: "Background agent completed: Investigate",
    display: true,
  }), true);
  assert.equal(isMessageGroupAnchor({
    role: "custom",
    customType: "workflow-result",
    content: "Workflow finished",
    display: true,
  }), false);
});

test("hides custom messages without display, as pi's TUI does", async () => {
  const { isHiddenCustomMessage, isMessageGroupAnchor } = await loadSubject();
  const custom = (customType, display) => ({ role: "custom", customType, content: "payload", display });

  assert.equal(isHiddenCustomMessage(custom("firstpick:session-summary-rpc", false)), true);
  assert.equal(isHiddenCustomMessage(custom("legacy", undefined)), true);
  assert.equal(isHiddenCustomMessage(custom("extension", true)), false);
  assert.equal(isHiddenCustomMessage({ role: "user", content: "prompt" }), false);
  assert.equal(isHiddenCustomMessage(assistant([])), false);
  // Nothing renders for it, so it cannot start a turn either.
  assert.equal(isMessageGroupAnchor(custom("pi-web:subagent-notification", false)), false);
  assert.equal(isMessageGroupAnchor(custom("compaction", false)), false);
});

test("isAssistantTruncated is true only for a finished stopReason length", async () => {
  const { isAssistantTruncated } = await loadSubject();

  const truncated = {
    ...assistant([{ type: "thinking", thinking: " lengthy reasoning " }]),
    stopReason: "length",
  };
  assert.equal(isAssistantTruncated(truncated), true);
  // Still streaming: the final stopReason is not known yet.
  assert.equal(isAssistantTruncated(truncated, { isStreaming: true }), false);
  assert.equal(isAssistantTruncated({ ...assistant([]), stopReason: "stop" }), false);
  assert.equal(isAssistantTruncated({ ...assistant([]), stopReason: "error", errorMessage: "oops" }), false);
  assert.equal(isAssistantTruncated({ ...assistant([]) }), false);
});

test("collapses Process details only above an answer with text or an image (#906)", async () => {
  const { collapsesProcessDetails, splitFinalAssistantBlocks } = await loadSubject();
  // The answer a turn shows, built as ChatWindow builds it from the final message.
  const answerOf = (message) => ({ ...message, content: splitFinalAssistantBlocks(message).answerBlocks });

  assert.equal(collapsesProcessDetails(null), false);
  // The reported turn ends on empty error replies after text and a trailing
  // tool call: only the error shows, the text is in Process details.
  assert.equal(collapsesProcessDetails(answerOf({ ...assistant([]), stopReason: "error", errorMessage: "terminated" })), false);
  assert.equal(collapsesProcessDetails(answerOf({
    ...assistant([{ type: "thinking", thinking: "long reasoning" }]),
    stopReason: "length",
  })), false);
  assert.equal(collapsesProcessDetails(answerOf(assistant([{ type: "text", text: " \n" }]))), false);

  assert.equal(collapsesProcessDetails(answerOf(assistant([
    { type: "toolCall", toolCallId: "call-1", toolName: "bash", input: {} },
    { type: "text", text: "Final answer" },
  ]))), true);
  assert.equal(collapsesProcessDetails(answerOf(assistant([
    { type: "image", source: { type: "url", url: "https://example.com/final.png" } },
  ]))), true);
  // Text that made it out before the error is still an answer.
  assert.equal(collapsesProcessDetails(answerOf({
    ...assistant([{ type: "text", text: "Partial answer" }]),
    stopReason: "error",
    errorMessage: "Connection closed",
  })), true);
});

// ---------------------------------------------------------------------------
// findFinalAssistantIndex: a trailing non-pi tool call's epilogue

function userMsg(text) {
  return { role: "user", content: text };
}
function toolResultMsg() {
  return { role: "toolResult", content: "Appended to MEMORY.md", toolCallId: "call-m" };
}

test("the reply after a trailing memory_write is an epilogue, not the answer", async () => {
  const { findFinalAssistantIndex } = await loadSubject();
  // The reported shape (session 2026-11-12): summary + memory_write in one
  // message, then a short confirmation.
  const messages = [
    userMsg("clone hrms"),
    assistant([
      { type: "thinking", thinking: "wrap up" },
      { type: "text", text: "克隆成功 ✅ 根因与修复……" },
      { type: "toolCall", toolCallId: "call-m", toolName: "memory_write", input: {} },
    ]),
    toolResultMsg(),
    assistant([{ type: "text", text: "已记入长期记忆。仓库已克隆到 D:/tmp/hrms。" }]),
  ];
  assert.equal(findFinalAssistantIndex(messages, 0, messages.length), 1);
});

test("a pi tool call between text and the reply keeps the reply the answer", async () => {
  const { findFinalAssistantIndex } = await loadSubject();
  const messages = [
    userMsg("run the tests"),
    assistant([
      { type: "text", text: "Running the suite." },
      { type: "toolCall", toolCallId: "call-1", toolName: "bash", input: {} },
    ]),
    { role: "toolResult", content: "3 passed", toolCallId: "call-1" },
    assistant([{ type: "text", text: "All green: 3 passed." }]),
  ];
  assert.equal(findFinalAssistantIndex(messages, 0, messages.length), 3);
});

test("the epilogue walk chains across consecutive exempted calls and skips empty tails", async () => {
  const { findFinalAssistantIndex } = await loadSubject();
  const messages = [
    userMsg("finish up"),
    assistant([
      { type: "text", text: "结论与总结。" },
      { type: "toolCall", toolCallId: "call-m", toolName: "memory_write", input: {} },
    ]),
    toolResultMsg(),
    assistant([
      { type: "text", text: "补充档案。" },
      { type: "toolCall", toolCallId: "call-n", toolName: "memory_write", input: {} },
    ]),
    { role: "toolResult", content: "Appended again", toolCallId: "call-n" },
    assistant([{ type: "text", text: "都记好了。" }]),
  ];
  assert.equal(findFinalAssistantIndex(messages, 0, messages.length), 1);
});
