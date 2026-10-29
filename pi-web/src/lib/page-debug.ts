// Fork shim for upstream's debug-panel observability hooks (v0.13.0).
// Upstream's lib/page-debug.ts feeds the read-only Debug panel and the SSE
// page registry — both web form factor (multiple browser pages, /api routes,
// EventSources). This Electron fork has a single window and IPC push
// channels, so the panel was not adopted; merged component code keeps its
// call sites and this shim keeps them inert, with upstream's signatures so
// those call sites typecheck unchanged. If the Debug panel is ever wanted
// here, take upstream's file plus debug-types/page-stream-registry/
// stream-client and re-home the connection counters onto the push channel
// registry.

/** The Electron app is a single page; upstream generates one id per page. */
export function pageId(): string {
  const store = globalThis as Record<PropertyKey, unknown>;
  const existing = store[Symbol.for("pi-web:page-id")];
  if (typeof existing === "string") return existing;
  const id = "electron-main";
  store[Symbol.for("pi-web:page-id")] = id;
  return id;
}

/** This page's id without creating it; the single window always has one. */
export function peekPageId(): string | null {
  return "electron-main";
}

interface EventSourceLike {
  readonly readyState: number;
  addEventListener?(type: "open" | "error", listener: () => void): void;
}

/** No SSE here: hand the tracked source back unchanged. */
export function trackEventSource<T extends EventSourceLike>(_kind: string, source: T, _label: string | null = null): T {
  return source;
}

/** Nothing to record visibility for; matches upstream's call-often contract. */
export function startPageVisibilityTracking(): void {}

/** No debug snapshot to record a running poll into. */
export function noteRunningPoll(
  _startedAt: number,
  _outcome: "ok" | "error" | "aborted",
  _httpStatus: number | null,
  _endedAt: number | null = null,
): void {}
