/**
 * Renderer-visible API contract exposed by the preload bridge.
 *
 * Typed resource facades (sessions, files, models, auth, skills, plugins,
 * worktrees) are added per slice; the agent command dispatch stays a single
 * channel mirroring rpc-manager's send() switch (spec: Q8, mixed surface).
 */
export interface PiApi {
  ping(): Promise<string>;
}
