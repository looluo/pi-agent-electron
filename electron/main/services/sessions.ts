import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import {
  buildSessionContext,
  getSessionEntries,
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
import { projectTreeForResponse } from "@/lib/project-tree";
import { computeSessionTotalActiveMs } from "@/lib/session-timing";
import { generateSessionTitle } from "@/lib/session-title";
import { getRpcSessionInfos, getRunningRpcSessionIds } from "@/lib/rpc-manager";

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
      runningSessionIds: getRunningRpcSessionIds(),
    };
  });
}

/** Port of app/api/sessions/[id] (GET) — full session payload for the viewer. */
export async function sessionsGet(
  id: string,
  options: { deferThinking?: boolean; deferMedia?: boolean } = {},
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
  const context = buildSessionContext(entries as never, leafId, {
    deferThinking: options.deferThinking,
    deferToolResultImages: options.deferMedia,
  });
  const totalActiveMs = computeSessionTotalActiveMs(entries);

  const header = sm.getHeader();
  let modified = header?.timestamp ?? new Date().toISOString();
  try { modified = statSync(filePath).mtime.toISOString(); } catch { /* use header timestamp */ }
  const parentSessionId = header?.parentSession
    ? await resolveSessionIdByPath(header.parentSession)
    : undefined;
  const info = header ? {
    path: filePath,
    id: header.id,
    cwd: header.cwd ?? "",
    name: sm.getSessionName(),
    created: header.timestamp,
    modified,
    messageCount: context.messages.length,
    firstMessage: context.messages.find((m) => m.role === "user")
      ? (() => {
          const msg = context.messages.find((m) => m.role === "user")!;
          const c = (msg as { content: unknown }).content;
          return typeof c === "string" ? c : (Array.isArray(c) ? (c.find((b: { type: string }) => b.type === "text") as { text: string } | undefined)?.text ?? "" : "") || "(no messages)";
        })()
      : "(no messages)",
    parentSessionId,
    transient: !filePath || !existsSync(filePath),
  } : null;

    return {
      sessionId: id,
      filePath,
      info,
      leafId,
      tree,
      context,
      totalActiveMs,
    };
  });
}

/** Port of app/api/sessions/[id]/context (GET). */
export async function sessionsContext(
  id: string,
  options: { leafId?: string; deferThinking?: boolean; deferMedia?: boolean } = {},
) {
  const rpc = getRpcSession(id);
  const liveRpc = rpc?.isAlive() ? rpc : undefined;
  const filePath = liveRpc ? null : await resolveSessionPath(id);
  if (!liveRpc && !filePath) return { notFound: true as const };

  const sm = liveRpc?.inner.sessionManager ?? SessionManager.open(filePath!);
  const context = buildSessionContext(sm.getEntries() as never, options.leafId, {
    deferThinking: options.deferThinking,
    deferToolResultImages: options.deferMedia,
  });
  return { context };
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

  const parentSessionPath = readSessionHeader(filePath)?.parentSession;

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
          writeFileSync(childPath, lines.join("\n"));
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* skip if dir unreadable */ }

  await getRpcSession(id)?.shutdown();
  unlinkSync(filePath);
  invalidateSessionPathCache(id);
  invalidateSessionListCache();
  return { ok: true as const };
}

/** Port of app/api/sessions/[id]/auto-name (POST). */
export async function sessionsAutoName(id: string) {
  const filePath = await resolveSessionPath(id);
  if (!filePath) return { notFound: true as const };

  const existing = getRpcSession(id);
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
