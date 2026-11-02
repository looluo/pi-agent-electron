/**
 * Port of app/api/sessions/stats (POST): the agent switcher's per-agent usage —
 * the totals the stats popover shows, for the main session and each subagent
 * at once. Reads like sessionsGet (a live wrapper's entries, else the cached
 * file) and never starts an AgentSession. The switcher polls this while an
 * agent runs, so a summary is reused until its session gains an entry.
 */
import { getRpcSession } from "@/lib/rpc-manager";
import { getSessionSettings, openSessionManager, resolveSessionPath } from "@/lib/session-reader";
import { computeSessionStats, type SessionUsageSummary } from "@/lib/session-stats";
import { computeSessionTotalActiveMs } from "@/lib/session-timing";
import { sideOwnEntries } from "@/lib/side-session";
import { SESSION_ID_PATTERN } from "@/lib/session-ui-state-shared";
import type { SessionEntry } from "@/lib/types";

const MAX_SESSION_STATS_IDS = 200;

type SessionManagerLike = ReturnType<typeof openSessionManager>;

interface CachedSummary {
  entryCount: number;
  lastEntryId: string | undefined;
  leafId: string | null;
  summary: SessionUsageSummary;
}

const summaries = new WeakMap<SessionManagerLike, CachedSummary>();

async function readSummary(id: string): Promise<SessionUsageSummary | null> {
  const rpc = getRpcSession(id);
  let sm: SessionManagerLike;
  if (rpc?.isAlive()) {
    sm = rpc.inner.sessionManager as SessionManagerLike;
  } else {
    const path = await resolveSessionPath(id);
    if (!path) return null;
    sm = openSessionManager(path);
  }
  const entries = sm.getEntries();
  const lastEntryId = (entries[entries.length - 1] as { id?: string } | undefined)?.id;
  const leafId = sm.getLeafId();
  const cached = summaries.get(sm);
  if (cached && cached.entryCount === entries.length && cached.lastEntryId === lastEntryId && cached.leafId === leafId) return cached.summary;

  const ownEntries = sideOwnEntries(entries);
  const stats = computeSessionStats(ownEntries as unknown as SessionEntry[]);
  const summary: SessionUsageSummary = {
    tokens: stats.tokens,
    cost: stats.cost,
    toolCalls: stats.toolCalls,
    totalActiveMs: computeSessionTotalActiveMs(ownEntries as typeof entries),
    ...getSessionSettings(entries as unknown as SessionEntry[], leafId),
  };
  summaries.set(sm, { entryCount: entries.length, lastEntryId, leafId, summary });
  return summary;
}

/** POST /api/sessions/stats — body { ids } (at most 200). Answers
 *  { stats: { [id]: SessionUsageSummary } }; an id not found is left out. */
export async function sessionsStats(ids: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { status: 400, body: { error: "ids must be a non-empty array" } };
  }
  if (ids.length > MAX_SESSION_STATS_IDS) {
    return { status: 400, body: { error: `ids may hold at most ${MAX_SESSION_STATS_IDS} session ids` } };
  }
  if (!ids.every((id) => typeof id === "string" && SESSION_ID_PATTERN.test(id))) {
    return { status: 400, body: { error: "ids must be session ids" } };
  }
  const stats: Record<string, SessionUsageSummary> = {};
  for (const id of new Set(ids as string[])) {
    try {
      const summary = await readSummary(id);
      if (summary) stats[id] = summary;
    } catch {
      // Malformed or concurrently removed session: leave it out.
    }
  }
  return { status: 200, body: { stats } };
}
