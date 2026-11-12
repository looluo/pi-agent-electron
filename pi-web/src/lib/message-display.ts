import type { AgentMessage, AssistantContentBlock, AssistantMessage, ThinkingContent, ToolCallContent } from "./types";

interface DisplayOptions {
  isStreaming?: boolean;
}

export function getThinkingPreview(thinking: string): string {
  return thinking.trimStart().match(/^[^\r\n]{0,240}/u)?.[0].trimEnd() ?? "";
}

export const THINKING_PIECE_CHARS = 8_000;

/** A piece of a thinking text; `lineBreak`: a "\n" follows it there, left out of the pieces. */
export interface ThinkingPiece {
  text: string;
  lineBreak: boolean;
}

/**
 * Cuts a long thinking text at the first line break past each
 * THINKING_PIECE_CHARS characters, so the expanded block lays it out piece
 * by piece (#1196). The line break at a cut is left out: the block boundary
 * stands in for it. One that ends an empty line is never a cut. A piece with
 * no line break by twice THINKING_PIECE_CHARS is cut there, losing nothing
 * and never splitting a surrogate pair. A cut depends only on the text
 * before it, so while thinking streams only the last piece changes. Text that
 * fits one piece stays one.
 */
export function splitThinkingPieces(thinking: string): ThinkingPiece[] {
  const pieces: ThinkingPiece[] = [];
  let start = 0;
  while (thinking.length - start > THINKING_PIECE_CHARS) {
    const from = start + THINKING_PIECE_CHARS;
    const hardCut = from + THINKING_PIECE_CHARS;
    // Searched up to the hard cut only: an unbroken line is not scanned to
    // its end again for every piece.
    const window = thinking.slice(from, hardCut + 1);
    let found = window.indexOf("\n");
    // Never at a "\n" that ends an empty line: the piece would end in a line
    // break, and a block draws no line for a trailing one, so that empty line
    // would be lost.
    while (found >= 0 && /\n\r?$/.test(thinking.slice(from + found - 2, from + found))) {
      found = window.indexOf("\n", found + 1);
    }
    if (found >= 0) {
      const lineBreak = from + found;
      if (lineBreak === thinking.length - 1) break;
      pieces.push({ text: thinking.slice(start, lineBreak), lineBreak: true });
      start = lineBreak + 1;
    } else if (thinking.length > hardCut) {
      const last = thinking.charCodeAt(hardCut - 1);
      const cut = last >= 0xd800 && last <= 0xdbff ? hardCut - 1 : hardCut;
      pieces.push({ text: thinking.slice(start, cut), lineBreak: false });
      start = cut;
    } else {
      break;
    }
  }
  pieces.push({ text: thinking.slice(start), lineBreak: false });
  return pieces;
}

/**
 * pi's TUI renders a custom message only when `display` is set; `display: false`
 * is how an extension keeps a message for the model alone. The chat skips it too.
 */
export function isHiddenCustomMessage(message: { role?: AgentMessage["role"]; display?: boolean }): boolean {
  return message.role === "custom" && !message.display;
}

export function isMessageGroupAnchor(message: { role?: AgentMessage["role"]; customType?: string; display?: boolean }): boolean {
  // A background subagent completion starts a new displayed turn, same as a
  // user message or compaction summary: pi-web's own, and @tintinweb/pi-subagents'
  // (a follow-up that triggers a turn). Other custom messages stay inside the turn.
  return message.role === "user"
    || (message.role === "custom" && !isHiddenCustomMessage(message) && (
      message.customType === "compaction"
      || message.customType === "pi-web:subagent-notification"
      || message.customType === "subagent-notification"
    ));
}

export function isEmptyThinkingBlock(block: AssistantContentBlock, options: DisplayOptions = {}): block is ThinkingContent {
  return block.type === "thinking" && !block.deferred && !options.isStreaming && block.thinking.trim() === "";
}

export function getDisplayableAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): AssistantContentBlock[] {
  return (message.content ?? []).filter((block) => !isEmptyThinkingBlock(block, options));
}

export function getAssistantErrorMessage(
  message: AssistantMessage,
  options: DisplayOptions = {},
): string | null {
  if (options.isStreaming || message.stopReason !== "error") return null;
  return message.errorMessage?.trim() || "Unknown provider error";
}

/**
 * A turn that ended on `stopReason: "length"` spent its whole output budget
 * (often on reasoning alone) and produced no final answer; without a notice it
 * looks like a hung session. The copy lives in i18n (`chat.truncatedByOutputLimit`).
 */
export function isAssistantTruncated(
  message: AssistantMessage,
  options: DisplayOptions = {},
): boolean {
  return !options.isStreaming && message.stopReason === "length";
}

/** Text, an image, or a tool call is an answer. Thinking alone is not. */
export function hasAssistantAnswer(message: AssistantMessage): boolean {
  return (message.content ?? []).some((block) => {
    if (block.type === "text") return block.text.trim().length > 0;
    return block.type === "image" || block.type === "toolCall";
  });
}

function isFinalAnswerBlock(block: AssistantContentBlock): boolean {
  return block.type === "text" || block.type === "image";
}

/** Tools pi ships whose calls visibly change the workspace or drive the turn:
 *  a fold explains them (rpc-manager's coding set, the session-level tools and
 *  pi's subagent tools). A call of any other tool — an extension's like
 *  pi-memory's memory_write, or an MCP server's — may ride at the end of an
 *  answer without turning the text before it into process. */
const PROCESS_TOOL_NAMES = new Set([
  "read", "bash", "powershell", "edit", "write", "grep", "find", "ls",
  "lookup", "ask", "codemode", "tool_search", "scripted", "searchable",
  "Agent", "get_subagent_result", "steer_subagent",
]);

/** A tool call the fold counts as process: one of pi's own work tools. */
export function isProcessToolCall(block: AssistantContentBlock): boolean {
  return block.type === "toolCall" && PROCESS_TOOL_NAMES.has(block.toolName);
}

export function splitFinalAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): { answerBlocks: AssistantContentBlock[]; processBlocks: AssistantContentBlock[] } {
  const blocks = getDisplayableAssistantBlocks(message, options);
  let lastProcessIndex = blocks.findLastIndex((block) => !isFinalAnswerBlock(block));
  // A trailing run of non-pi tool calls (an extension writing its memory, an
  // MCP server) is not work the fold explains: skip it, so the answer text
  // before such a call stays the answer instead of folding away (#pi-memory).
  while (lastProcessIndex >= 0 && blocks[lastProcessIndex].type === "toolCall" && !isProcessToolCall(blocks[lastProcessIndex])) {
    lastProcessIndex = blocks.findLastIndex((block, index) => index < lastProcessIndex && !isFinalAnswerBlock(block));
  }
  if (lastProcessIndex === -1) {
    return { answerBlocks: blocks, processBlocks: [] };
  }
  return {
    answerBlocks: blocks.slice(lastProcessIndex + 1),
    processBlocks: blocks.slice(0, lastProcessIndex + 1),
  };
}

export function countToolCallBlocks(blocks: AssistantContentBlock[]): number {
  return blocks.filter((block): block is ToolCallContent => block.type === "toolCall").length;
}

/** An assistant message the turn can show an answer from: trailing text or an
 *  image. A message whose only tail is a non-pi tool call has its text before
 *  that call as the answer (splitFinalAssistantBlocks), so it qualifies too. */
export function hasFinalAssistantAnswer(message: AgentMessage): boolean {
  if (message.role !== "assistant") return false;
  return splitFinalAssistantBlocks(message as AssistantMessage).answerBlocks.some((block) => (
    block.type === "image" || (block.type === "text" && block.text.trim().length > 0)
  ));
}

/** Whether the assistant message ends with a run of non-pi tool calls over
 *  answer text — the shape of an extension (pi-memory's memory_write) or an
 *  MCP server riding on a finished answer. */
function endsWithExemptedCallOverAnswer(message: AssistantMessage): boolean {
  const blocks = getDisplayableAssistantBlocks(message);
  const last = blocks[blocks.length - 1];
  return Boolean(
    last
    && last.type === "toolCall"
    && !isProcessToolCall(last)
    && blocks.some((block) => block.type === "text" && block.text.trim().length > 0),
  );
}

/** The turn's final assistant message: the last one with an answer, walking
 *  back over a trailing non-pi tool call's chain. A reply that only follows
 *  such a call (the confirmation after memory_write) is an epilogue, not the
 *  answer: the message whose text preceded the call stays the answer, and the
 *  epilogue renders after it instead of folding the answer away. */
export function findFinalAssistantIndex(messages: AgentMessage[], userIdx: number, endIdx: number): number {
  let answerIdx = -1;
  for (let candidateIdx = endIdx - 1; candidateIdx > userIdx; candidateIdx--) {
    if (hasFinalAssistantAnswer(messages[candidateIdx])) { answerIdx = candidateIdx; break; }
  }
  if (answerIdx === -1) {
    for (let candidateIdx = endIdx - 1; candidateIdx > userIdx; candidateIdx--) {
      if (messages[candidateIdx]?.role === "assistant") return candidateIdx;
    }
    return -1;
  }
  // Walk back over [assistant(text + exempted call), toolResult, candidate]:
  // each step makes the earlier message the answer, and may chain again.
  for (let prev = answerIdx - 1; prev > userIdx; prev--) {
    const message = messages[prev];
    if (message.role === "toolResult") continue;
    if (message.role !== "assistant") break;
    if (endsWithExemptedCallOverAnswer(message as AssistantMessage) && hasFinalAssistantAnswer(message)) {
      answerIdx = prev;
      continue;
    }
    break;
  }
  return answerIdx;
}

/**
 * Process details start collapsed only above a real answer: text or an image in
 * the answer the turn shows (null when it shows none). Under an error or
 * truncation notice alone they stay open, since text the turn wrote before its
 * last tool call sits in them and would be hidden (#906).
 */
export function collapsesProcessDetails(answer: AssistantMessage | null): boolean {
  return (answer?.content ?? []).some((block) => (
    block.type === "image" || (block.type === "text" && block.text.trim().length > 0)
  ));
}
