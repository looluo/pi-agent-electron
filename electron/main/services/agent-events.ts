import type { AgentEventLike } from "@/lib/agent-event-wire";
import {
  isEventIncludedInSnapshot,
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
    const forward = (event: AgentEventLike, snapshot: unknown) => {
      if (isEventIncludedInSnapshot(event, snapshot)) return;
      const clientEvent = toClientAgentEvent(event);
      if (clientEvent) send(subscription, { kind: "event", data: JSON.stringify(clientEvent) });
    };

    const stopListening = session.onEvent((event: AgentEventLike) => {
      if (!snapshotPublished) {
        buffered.push(event);
        return;
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
