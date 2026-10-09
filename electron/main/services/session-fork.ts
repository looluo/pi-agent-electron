/**
 * Port of app/api/sessions/[id]/fork (POST): copies the session's current
 * branch into a new file named after the source plus a short random suffix.
 * File-level work, like rename and delete: never starts, prompts or shuts
 * down an AgentSession.
 */
import { getRpcSession } from "@/lib/rpc-manager";
import { forkSessionBranch, readForkSourceTitle, SessionForkError } from "@/lib/session-fork";
import {
  cacheSessionPath,
  invalidateSessionListCache,
  invalidateSessionPathCache,
  readLatestSessionEntryId,
  readSessionInfo,
  resolveSessionPath,
} from "@/lib/session-reader";
import type { SessionInfo } from "@/lib/types";

/** POST /api/sessions/[id]/fork — answers with the new session. */
export async function sessionsFork(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const refusal = (status: number, code: string, error: string) => ({ status, body: { error, code } });

  try {
    const opened = getRpcSession(id);
    const sourcePath = (opened?.isAlive() ? opened.sessionFile : "") || await resolveSessionPath(id);
    if (!sourcePath) {
      invalidateSessionListCache();
      return refusal(404, "not_found", "Session not found");
    }
    // The title the sidebar shows for the source, which the copy's name
    // starts with (null: the source has none, the copy stays unnamed). Read
    // first: the copy below allows no await.
    const sourceTitle = await readForkSourceTitle(sourcePath);

    // No await from here until the copy exists: pi appends finished entries
    // synchronously in this process, so the leaf read here and the file read
    // by forkSessionBranch() see the same entries.
    const wrapper = getRpcSession(id);
    let liveLeafId = wrapper?.isAlive() ? wrapper.inner.sessionManager.getLeafId() : undefined;
    if (wrapper && liveLeafId !== undefined && !wrapper.isRunning()) {
      const diskLatest = readLatestSessionEntryId(wrapper.sessionFile);
      if (diskLatest && !wrapper.inner.sessionManager.getEntry(diskLatest)) liveLeafId = undefined;
    }
    const fork = forkSessionBranch(sourcePath, liveLeafId, sourceTitle);
    cacheSessionPath(fork.sessionId, fork.path);
    invalidateSessionListCache();

    // Read after the name was written: the row carries it.
    const info = await readSessionInfo(fork.path);
    if (!info) throw new Error("The forked session could not be read");
    const session: SessionInfo = { ...info, parentSessionId: id, relation: { kind: "fork", originSessionId: id } };
    return { status: 200, body: { sessionId: fork.sessionId, session } };
  } catch (error) {
    if (error instanceof SessionForkError) {
      if (error.code === "not_found") {
        invalidateSessionPathCache(id);
        invalidateSessionListCache();
        return refusal(404, error.code, error.message);
      }
      return refusal(409, error.code, error.message);
    }
    return refusal(500, "failed", error instanceof Error ? error.message : String(error));
  }
}
