// Remembers which "process details" groups the user expanded, per session.
// sessionStorage (not localStorage): survives conversation switches and
// in-app navigation, resets when the app closes — deliberate, so a fresh run
// starts from the collapsed defaults instead of stale expansion state.
const STORAGE_KEY_PREFIX = "pi-process-groups:";
const MAX_REMEMBERED = 200;

function readSet(sessionId: string): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY_PREFIX + sessionId);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(sessionId: string, ids: Set<string>): void {
  try {
    let list = [...ids];
    if (list.length > MAX_REMEMBERED) list = list.slice(list.length - MAX_REMEMBERED);
    window.sessionStorage.setItem(STORAGE_KEY_PREFIX + sessionId, JSON.stringify(list));
  } catch {
    // Storage unavailable (quota, private mode, non-browser) — persistence is
    // best-effort; silently fall back to no persistence.
  }
}

export function isProcessGroupExpanded(sessionId: string, anchorId: string): boolean {
  if (typeof window === "undefined") return false;
  return readSet(sessionId).has(anchorId);
}

export function setProcessGroupExpanded(sessionId: string, anchorId: string, expanded: boolean): void {
  if (typeof window === "undefined") return;
  const ids = readSet(sessionId);
  if (expanded) ids.add(anchorId);
  else ids.delete(anchorId);
  writeSet(sessionId, ids);
}
