import type { AgentEventLike } from "@/lib/agent-event-wire";
import {
  isEventIncludedInSnapshot,
  isNestedToolExecutionEvent,
  toClientAgentEvent,
} from "@/lib/agent-event-wire";
import type { AgentSessionWrapper } from "@/lib/rpc-manager";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { resolveSessionPath } from "@/lib/session-reader";
import type { WebContents } from "electron";

/**
 * Port of app/api/agent/[id]/events + lib/agent-event-stream for IPC push.
 *
 * Mirrors the SSE semantics exactly: subscribe before readiness, buffer until
 * the snapshot is published, then emit `connected`, replay the buffer, and
 * publish the streaming-message snapshot as message_start. The renderer-side
 * adapter (IpcAgentEventSource) turns frames back into EventSource shape so
 * AgentEventConnection's handshake keeps working unchanged.
 */

export type AgentEventFrame =
  | { kind: "open" }
  | { kind: "event"; data: string }
  | { kind: "closed" };

type Subscription = {
  sessionId: string;
  webContents: WebContents;
  unsubscribe: (() => void) | null;
  closed: boolean;
  onDestroyed: () => void;
};

const subscriptions = new Map<string, Subscription>();

/** How long tool_execution_update events wait to be coalesced (upstream
 *  b8e0b71): each update carries the tool's whole partial result, so only the
 *  latest per tool call matters — a burst reaches the renderer as one frame. */
const TOOL_UPDATE_COALESCE_MS = 150;

/** Pre-snapshot buffer cap (upstream 6b0c6a5 semantics adapted to IPC): a
 *  session that publishes no snapshot must not accumulate unbounded events;
 *  repairable events (deltas, partial tool results) are dropped first. */
const BUFFER_HIGH_WATER_EVENTS = 500;

function isDroppableEvent(event: AgentEventLike): boolean {
  if (event.type === "tool_execution_update") return true;
  if (event.type !== "message_update") return false;
  const update = event.assistantMessageEvent;
  return typeof update === "object"
    && update !== null
    && typeof (update as { type?: unknown }).type === "string"
    && (update as { type: string }).type.endsWith("_delta");
}

function send(subscription: Subscription, frame: AgentEventFrame): void {
  if (subscription.closed) return;
  try {
    subscription.webContents.send(`pi:agent-events:${subscription.sessionId}`, frame);
  } catch {
    // webContents gone; dropAgentEvents cleans up via the destroyed hook.
  }
}

export async function openAgentEvents(
  webContents: WebContents,
  token: string,
  sessionId: string,
): Promise<void> {
  if (subscriptions.has(token)) return;

  const subscription: Subscription = {
    sessionId,
    webContents,
    unsubscribe: null,
    closed: false,
    onDestroyed: () => {},
  };
  subscriptions.set(token, subscription);
  subscription.onDestroyed = () => dropAgentEvents(token);
  webContents.once("destroyed", subscription.onDestroyed);

  // Ack the transport first (the SSE route flushed headers before readiness).
  send(subscription, { kind: "open" });

  // Resolve or start the session without blocking the caller.
  const sessionPromise = (async (): Promise<AgentSessionWrapper> => {
    const existing = getRpcSession(sessionId);
    if (existing?.isAlive()) return existing;
    const filePath = await resolveSessionPath(sessionId);
    if (!filePath) throw new Error("Session not found");
    const { session } = await startRpcSession(sessionId, filePath, undefined);
    return session;
  })();

  try {
    const session = await sessionPromise;

    const buffered: AgentEventLike[] = [];
    let snapshotPublished = false;
    // Coalesced tool updates: latest partial result per tool call, flushed on a
    // short timer so a burst crosses the IPC boundary once per call.
    const pendingToolUpdates = new Map<string, AgentEventLike>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToolUpdates = () => {
      flushTimer = null;
      for (const update of pendingToolUpdates.values()) {
        forward(update, session.streamingMessage);
      }
      pendingToolUpdates.clear();
    };
    const forward = (event: AgentEventLike, snapshot: unknown) => {
      if (isEventIncludedInSnapshot(event, snapshot)) return;
      // A call a tool made itself (a codemode script's) belongs to its parent's
      // card; forwarded here it would show as a top-level running tool.
      if (isNestedToolExecutionEvent(event)) return;
      const clientEvent = toClientAgentEvent(event);
      if (clientEvent) send(subscription, { kind: "event", data: JSON.stringify(clientEvent) });
    };

    const stopListening = session.onEvent((event: AgentEventLike) => {
      if (!snapshotPublished) {
        // Bounded pre-snapshot buffering (6b0c6a5 adapted): drop repairable
        // events first, then oldest non-droppables, rather than grow forever.
        if (event.type === "tool_execution_update") {
          pendingToolUpdates.set(String(event.toolCallId), event);
          if (!flushTimer) flushTimer = setTimeout(flushToolUpdates, TOOL_UPDATE_COALESCE_MS);
          return;
        }
        buffered.push(event);
        if (buffered.length > BUFFER_HIGH_WATER_EVENTS) {
          const droppable = buffered.findIndex((e) => isDroppableEvent(e));
          if (droppable >= 0) buffered.splice(droppable, 1);
          else buffered.shift();
        }
        return;
      }
      if (event.type === "tool_execution_update") {
        pendingToolUpdates.set(String(event.toolCallId), event);
        if (!flushTimer) flushTimer = setTimeout(flushToolUpdates, TOOL_UPDATE_COALESCE_MS);
        return;
      }
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushToolUpdates();
      }
      forward(event, session.streamingMessage);
    });
    if (subscription.closed) {
      stopListening();
      return;
    }
    subscription.unsubscribe = stopListening;

    const snapshot = session.streamingMessage;
    send(subscription, {
      kind: "event",
      data: JSON.stringify({ type: "connected", sessionId, isStreaming: session.isStreaming }),
    });
    for (const event of buffered) forward(event, snapshot);
    if (snapshot !== undefined && snapshot !== null) {
      send(subscription, { kind: "event", data: JSON.stringify({ type: "message_start", message: snapshot }) });
    }
    snapshotPublished = true;
  } catch (error) {
    if (subscription.closed) return;
    send(subscription, {
      kind: "event",
      data: JSON.stringify({
        type: "startup_error",
        errorMessage: `Failed to start agent: ${error instanceof Error ? error.message : String(error)}`,
      }),
    });
    send(subscription, { kind: "closed" });
    dropAgentEvents(token);
  }
}

export function dropAgentEvents(token: string): void {
  const subscription = subscriptions.get(token);
  if (!subscription) return;
  subscriptions.delete(token);
  subscription.closed = true;
  subscription.unsubscribe?.();
  subscription.unsubscribe = null;
  try {
    subscription.webContents.removeListener("destroyed", subscription.onDestroyed);
  } catch {
    // webContents already destroyed
  }
}
