import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import {
  buildSessionContext,
  getSessionEntries,
  getSessionListVersion,
  invalidateSessionListCache,
  invalidateSessionPathCache,
  listAllSessions,
  mergeSessionLists,
  attachSessionProjectInfo,
  readSessionHeader,
  resolveSessionIdByPath,
  resolveSessionPath,
} from "@/lib/session-reader";
import { sessionPathKey } from "@/lib/session-path";
import { MAX_TOOL_RESULT_IMAGE_BYTES, TOOL_RESULT_IMAGE_MIMES } from "@/lib/tool-result-images";
import { projectTreeForResponse } from "@/lib/project-tree";
import { computeSessionTotalActiveMs } from "@/lib/session-timing";
import { searchSessionContents } from "@/lib/session-search";
import { computeSessionStats } from "@/lib/session-stats";
import { generateSessionTitle } from "@/lib/session-title";
import { getCompletionNotificationSuppressedRpcSessionIds, getRpcSessionInfos, getRunningRpcSessionIds } from "@/lib/rpc-manager";
import { readSubagentRun, readSubagentSessionResources, SUBAGENT_META_TYPE } from "@/lib/subagents";
import { readSessionToolSelection } from "@/lib/session-tool-selection";

/** Route-era error semantics: handlers resolve { error } instead of rejecting. */
async function guarded<T extends object>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Port of app/api/sessions (GET) — list + running snapshot. */
export async function sessionsList(force: boolean) {
  return guarded(async () => {
    const [persistedSessions, runtimeSessions] = await Promise.all([
      listAllSessions({ force }),
      attachSessionProjectInfo(getRpcSessionInfos()),
    ]);
    return {
      sessions: mergeSessionLists(persistedSessions, runtimeSessions),
      sessionListVersion: getSessionListVersion(),
      runningSessionIds: getRunningRpcSessionIds(),
      completionNotificationSuppressedSessionIds: getCompletionNotificationSuppressedRpcSessionIds(),
    };
  });
}

/** Port of app/api/sessions/search (GET) — literal content search over the
 *  sidebar's session catalog. The renderer's AbortSignal cannot cross IPC;
 *  searchSessionContents enforces its own time budget, and stale responses
 *  are dropped client-side via the request id. */
export async function sessionsSearch(query: string) {
  const trimmed = (query ?? "").trim();
  if (trimmed.length > 200) {
    return { status: 400 as const, body: { error: "Search query exceeds 200 characters" } };
  }
  try {
    const sessions = trimmed ? await listAllSessions() : [];
    return { status: 200 as const, body: await searchSessionContents(sessions, trimmed) };
  } catch (error) {
    return { status: 500 as const, body: { error: String(error) } };
  }
}

/** Port of app/api/sessions/[id] (GET) — full session payload for the viewer. */
export async function sessionsGet(
  id: string,
  options: { deferThinking?: boolean; deferMedia?: boolean; tail?: number } = {},
) {
  return guarded(async () => {
  const rpc = getRpcSession(id);
  const liveRpc = rpc?.isAlive() ? rpc : undefined;
  const resolvedPath = liveRpc ? null : await resolveSessionPath(id);
  if (!liveRpc && !resolvedPath) {
    return { notFound: true as const };
  }

  const sm = liveRpc?.inner.sessionManager ?? SessionManager.open(resolvedPath!);
  const filePath = liveRpc?.sessionFile || sm.getSessionFile() || resolvedPath || "";
  const entries = sm.getEntries();
  const leafId = sm.getLeafId();
  const tree = projectTreeForResponse(sm.getTree());
  const rawTail = Number(options.tail);
  const tail = Number.isFinite(rawTail) && rawTail > 0 ? Math.min(rawTail, 1000) : 50;
  const context = buildSessionContext(entries as never, leafId, {
    deferThinking: options.deferThinking,
    deferToolResultImages: options.deferMedia,
    tail,
    sessionId: id, // local: lazy URLs for historical tool-result images
  });
  const totalActiveMs = computeSessionTotalActiveMs(entries);
  // Cumulative usage over ALL entries, including history compacted away —
  // the same aggregation the SDK's getSessionStats() uses. Lets the client
  // keep monotonic token/cost counters across compaction and page reloads.
  const stats = computeSessionStats(entries as never);
  const sessionName = sm.getSessionName();
  const firstUserEntry = entries.find((entry) => entry.type === "message" && entry.message.role === "user");
  const firstUserMessage = firstUserEntry?.type === "message" ? firstUserEntry.message : undefined;

  const header = sm.getHeader();
  let modified = header?.timestamp ?? new Date().toISOString();
  try { modified = statSync(filePath).mtime.toISOString(); } catch { /* use header timestamp */ }
  const parentSessionId = header?.parentSession
    ? await resolveSessionIdByPath(header.parentSession)
    : undefined;
  const subagent = header
    ? readSubagentRun(entries as never, header.id, filePath)
    : null;
  const toolNames = readSubagentSessionResources(entries as never)?.tools
    ?? readSessionToolSelection(entries as never);
  const info = header ? (await attachSessionProjectInfo([{
    path: filePath,
    id: header.id,
    cwd: header.cwd ?? "",
    name: sessionName,
    created: header.timestamp,
    modified,
    messageCount: stats.totalMessages,
    firstMessage: firstUserMessage
      ? (() => {
          const c = (firstUserMessage as { content: unknown }).content;
          return typeof c === "string" ? c : (Array.isArray(c) ? (c.find((b: { type: string }) => b.type === "text") as { text: string } | undefined)?.text ?? "" : "") || "(no messages)";
        })()
      : "(no messages)",
    parentSessionId,
    ...(subagent
      ? { relation: { kind: "subagent" as const, parentSessionId: subagent.parentSessionId, profile: subagent.profile, description: subagent.description, status: liveRpc?.isRunning() ? "running" as const : subagent.status } }
      : header?.parentSession
        ? { relation: { kind: "fork" as const, ...(parentSessionId ? { originSessionId: parentSessionId } : {}) } }
        : {}),
    transient: !filePath || !existsSync(filePath),
  }]))[0] : null;

    return {
      sessionId: id,
      filePath,
      info,
      leafId,
      tree,
      context,
      stats,
      totalActiveMs,
      // Persisted tool selection (chat-only sessions, upstream a5738cf):
      // top-level — SessionData.toolNames, not part of info.
      ...(toolNames !== undefined ? { toolNames } : {}),
    };
  });
}

/** Port of app/api/sessions/[id]/context (GET). */
export async function sessionsContext(
  id: string,
  options: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean; tail?: number; before?: string } = {},
) {
  const rpc = getRpcSession(id);
  const liveRpc = rpc?.isAlive() ? rpc : undefined;
  const filePath = liveRpc ? null : await resolveSessionPath(id);
  if (!liveRpc && !filePath) return { notFound: true as const };

  // `tail` caps the ancestor chain returned (default 50); `before` rewinds the
  // walk start to an older entry so the client can page upward without
  // re-fetching the whole active branch.
  const rawTail = Number(options.tail);
  const tail = Number.isFinite(rawTail) && rawTail > 0 ? Math.min(rawTail, 1000) : 50;
  const before = options.before ?? undefined;

  const sm = liveRpc?.inner.sessionManager ?? SessionManager.open(filePath!);
  // `before` is the oldest entry already on the client; fetch its ancestors
  // only (excludeLeaf) so prepending the page does not duplicate `before`.
  const context = buildSessionContext(sm.getEntries() as never, before ?? options.leafId, {
    deferThinking: options.deferThinking,
    deferToolResultImages: options.deferMedia,
    tail,
    excludeLeaf: Boolean(before),
    sessionId: id,
  });
  return { context, tail, before: before ?? null };
}

/** Port of app/api/sessions/[id] (PATCH) — rename. */
export async function sessionsRename(id: string, name: string) {
  if (typeof name !== "string") throw new Error("name is required");
  const filePath = await resolveSessionPath(id);
  if (!filePath) return { notFound: true as const };
  const sm = SessionManager.open(filePath);
  sm.appendSessionInfo(name.trim());
  invalidateSessionListCache();
  return { ok: true as const };
}

/** Port of app/api/sessions/[id] (DELETE) — delete with cascade re-parent. */
export async function sessionsDelete(id: string) {
  const filePath = await resolveSessionPath(id);
  if (!filePath) return { notFound: true as const };

  // Read only the bounded header before deleting. Empty runtime sessions have a
  // cached path before their first disk write (upstream #440).
  let parentSessionPath: string | undefined;
  try {
    parentSessionPath = readSessionHeader(filePath)?.parentSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let parentSessionId: string | undefined;
  if (parentSessionPath) {
    try {
      // The parent may have been deleted or moved already; treat it as absent (upstream #659).
      parentSessionId = readSessionHeader(parentSessionPath)?.id;
    } catch {
      parentSessionId = undefined;
    }
  }

  // Re-attach all direct children to this session's parent (cascade re-parent)
  const targetPathKey = sessionPathKey(filePath);
  const dir = dirname(filePath);
  try {
    const files = readdirSync(dir).filter(
      (file) => file.endsWith(".jsonl") && sessionPathKey(join(dir, file)) !== targetPathKey,
    );
    for (const file of files) {
      const childPath = join(dir, file);
      try {
        const content = readFileSync(childPath, "utf8");
        const lines = content.split("\n");
        const header = JSON.parse(lines[0]) as { type?: string; parentSession?: string };
        if (
          header.type === "session" &&
          header.parentSession &&
          sessionPathKey(header.parentSession) === targetPathKey
        ) {
          header.parentSession = parentSessionPath;
          lines[0] = JSON.stringify(header);
          // Keep subagent relation metadata consistent when a mid-chain session
          // is deleted: repoint the child's subagent meta entry at the new
          // parent (upstream 39e50e0).
          if (parentSessionPath && parentSessionId) {
            for (let index = 1; index < lines.length; index += 1) {
              let entry: { type?: string; customType?: string; data?: unknown };
              try {
                entry = JSON.parse(lines[index]);
              } catch {
                continue;
              }
              if (
                entry.type !== "custom"
                || entry.customType !== SUBAGENT_META_TYPE
                || typeof entry.data !== "object"
                || entry.data === null
                || Array.isArray(entry.data)
              ) continue;
              entry.data = {
                ...entry.data,
                parentSessionId,
                parentSessionPath,
              };
              lines[index] = JSON.stringify(entry);
              break;
            }
          }
          writeFileSync(childPath, lines.join("\n"));
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* skip if dir unreadable */ }

  await getRpcSession(id)?.shutdown();
  try {
    unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  invalidateSessionPathCache(id);
  invalidateSessionListCache();
  return { ok: true as const };
}

/** Port of app/api/sessions/[id]/auto-name (POST). `skipIfNamed` powers the
 *  automatic post-run naming (pi-web PR #45 port): an unnamed session is
 *  titled through the same generation path as the manual button, while a
 *  session the user (or an earlier auto run) already named is left untouched. */
export async function sessionsAutoName(id: string, options: { skipIfNamed?: boolean } = {}) {
  const filePath = await resolveSessionPath(id);
  if (!filePath) return { notFound: true as const };

  const existing = getRpcSession(id);
  if (options.skipIfNamed) {
    const currentName = existing?.isAlive()
      ? existing.inner.sessionManager.getSessionName()
      : SessionManager.open(filePath).getSessionName();
    if (currentName) return { skipped: true as const, title: currentName };
  }

  const { session } = existing?.isAlive()
    ? { session: existing }
    : await startRpcSession(id, filePath, undefined);

  await session.waitUntilReady?.();
  const result = await generateSessionTitle(session.inner as unknown as AgentSession);

  if (!session.isAlive()) {
    return { conflict: true as const, error: "The session was closed while its title was being generated. Please try again." };
  }

  session.inner.setSessionName(result.title);
  invalidateSessionListCache();
  return { title: result.title, usage: result.usage ?? null };
}

/** Port of app/api/sessions/[id]/entries/[entryId]/thinking (GET). */
export async function sessionsThinking(id: string, entryId: string, blockIndex: number) {
  if (!Number.isSafeInteger(blockIndex) || blockIndex < 0) {
    return { badRequest: true as const, error: "Valid blockIndex is required" };
  }
  const filePath = await resolveSessionPath(id);
  if (!filePath) return { notFound: true as const };

  const entry = getSessionEntries(filePath).find((candidate) => candidate.id === entryId);
  if (!entry || entry.type !== "message" || entry.message.role !== "assistant") {
    return { notFound: true as const };
  }

  const block = entry.message.content[blockIndex];
  if (!block || block.type !== "thinking") {
    return { notFound: true as const };
  }

  return { thinking: block.thinking };
}

/** Port of app/api/sessions/[id]/entries/[entryId]/tool-result-image (GET) —
 *  serves a historical tool-result image on demand (lazy pifile:// URLs). */
export async function sessionToolResultImage(
  id: string,
  entryId: string,
  blockIndex: number,
): Promise<{ bytes: Uint8Array; mime: string } | { error: string; status: number }> {
  if (!Number.isSafeInteger(blockIndex) || blockIndex < 0) {
    return { error: "Valid blockIndex is required", status: 400 };
  }

  const filePath = await resolveSessionPath(id);
  if (!filePath) return { error: "Session not found", status: 404 };

  const entry = getSessionEntries(filePath).find((candidate) => candidate.id === entryId);
  if (!entry || entry.type !== "message" || entry.message.role !== "toolResult") {
    return { error: "Tool result not found", status: 404 };
  }

  const image = readBase64Image(entry.message.content[blockIndex]);
  if (!image) return { error: "Tool result image not found", status: 404 };
  if (!TOOL_RESULT_IMAGE_MIMES.has(image.mime)) {
    return { error: "Unsupported image type", status: 415 };
  }

  const bytes = decodeBoundedBase64(image.data);
  if (!bytes) return { error: "Invalid or oversized image data", status: 413 };

  return { bytes, mime: image.mime };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBase64Image(block: unknown): { data: string; mime: string } | null {
  if (!isRecord(block) || block.type !== "image") return null;

  if (typeof block.data === "string" && typeof block.mimeType === "string") {
    return { data: block.data, mime: block.mimeType };
  }

  if (
    isRecord(block.source) &&
    block.source.type === "base64" &&
    typeof block.source.data === "string" &&
    typeof block.source.media_type === "string"
  ) {
    return { data: block.source.data, mime: block.source.media_type };
  }

  return null;
}

function decodeBoundedBase64(data: string): Uint8Array | null {
  // Reject malformed and obviously oversized payloads before allocating.
  if (
    data.length === 0 ||
    data.length > Math.ceil(MAX_TOOL_RESULT_IMAGE_BYTES * 4 / 3) + 4 ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
  ) {
    return null;
  }

  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_TOOL_RESULT_IMAGE_BYTES) return null;
  return new Uint8Array(bytes);
}
