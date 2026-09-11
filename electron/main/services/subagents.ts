import { existsSync } from "fs";
import type { SubagentProfile, SubagentWritableScope } from "@/lib/subagents";
import {
  deleteSubagentProfile,
  listSubagentProfileSources,
  saveSubagentProfile,
} from "@/lib/subagents";
import { readSubagentSettings, writeBuiltInSubagentsEnabled, writeSubagentMaxConcurrent } from "@/lib/subagent-settings";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { abortSubagent, getSubagentRun, steerSubagent } from "@/lib/rpc-manager";

type StatusBody = { status: number; body: Record<string, unknown> };

function errorBody(error: unknown, accessDeniedStatus = 400): StatusBody {
  const message = error instanceof Error ? error.message : String(error);
  return { status: message === "Access denied" ? 403 : accessDeniedStatus, body: { error: message } };
}

async function validateCwd(cwd: unknown): Promise<string> {
  if (typeof cwd !== "string" || !cwd || !existsSync(cwd)) throw new Error("Valid cwd required");
  if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) throw new Error("Access denied");
  return cwd;
}

function validateScope(scope: unknown): SubagentWritableScope {
  if (scope !== "global" && scope !== "project") throw new Error("scope must be global or project");
  return scope;
}

/** Port of app/api/subagents/[id] (GET) — inspect a subagent run. */
export async function subagentsGetRun(id: string): Promise<StatusBody> {
  try {
    const run = await getSubagentRun(id);
    if (!run) return { status: 404, body: { error: "Subagent not found" } };
    return { status: 200, body: { run: run as unknown as Record<string, unknown> } };
  } catch (error) {
    return errorBody(error, 500);
  }
}

/** Port of app/api/subagents/[id] (POST) — steer or abort a subagent run. */
export async function subagentsAction(id: string, body: Record<string, unknown>): Promise<StatusBody> {
  try {
    if (body.action === "steer") {
      if (typeof body.message !== "string" || !body.message.trim()) {
        return { status: 400, body: { error: "message required" } };
      }
      await steerSubagent(id, body.message);
    } else if (body.action === "abort") {
      await abortSubagent(id);
    } else {
      return { status: 400, body: { error: "action must be steer or abort" } };
    }
    return { status: 200, body: { ok: true, run: await getSubagentRun(id) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: message.includes("not running") ? 409 : 500, body: { error: message } };
  }
}

/** Port of app/api/subagents/profiles (GET). */
export async function subagentsProfilesList(cwd: unknown): Promise<StatusBody> {
  try {
    const validated = await validateCwd(cwd);
    return { status: 200, body: { profiles: listSubagentProfileSources(validated) as unknown as Record<string, unknown> } };
  } catch (error) {
    return errorBody(error);
  }
}

/** Port of app/api/subagents/profiles (PUT) — create or replace a profile. */
export async function subagentsProfilesSave(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const cwd = await validateCwd(body.cwd);
    const scope = validateScope(body.scope);
    const profile = body.profile as Omit<SubagentProfile, "scope" | "filePath"> | undefined;
    if (!profile || typeof profile.name !== "string") {
      return { status: 400, body: { error: "profile required" } };
    }
    return { status: 200, body: { profile: saveSubagentProfile(cwd, scope, profile) as unknown as Record<string, unknown> } };
  } catch (error) {
    return errorBody(error);
  }
}

/** Port of app/api/subagents/profiles (PATCH) — toggle profile enabled. */
export async function subagentsProfilesToggle(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const cwd = await validateCwd(body.cwd);
    const scope = validateScope(body.scope);
    if (typeof body.name !== "string") return { status: 400, body: { error: "name required" } };
    if (typeof body.enabled !== "boolean") return { status: 400, body: { error: "enabled required" } };
    const name = body.name;
    const source = listSubagentProfileSources(cwd).find((candidate) =>
      candidate.scope === scope && candidate.name.toLowerCase() === name.toLowerCase()
    );
    if (!source) return { status: 404, body: { error: "Agent profile not found" } };
    const profile: Omit<SubagentProfile, "scope" | "filePath"> = {
      name: source.name,
      displayName: source.displayName,
      description: source.description,
      systemPrompt: source.systemPrompt,
      tools: source.tools,
      loadSkills: source.loadSkills,
      loadExtensions: source.loadExtensions,
      model: source.model,
      thinking: source.thinking,
      maxTurns: source.maxTurns,
      inheritContext: source.inheritContext,
      runInBackground: source.runInBackground,
      promptMode: source.promptMode,
      enabled: source.enabled,
    };
    return { status: 200, body: { profile: saveSubagentProfile(cwd, scope, { ...profile, enabled: body.enabled }) as unknown as Record<string, unknown> } };
  } catch (error) {
    return errorBody(error);
  }
}

/** Port of app/api/subagents/profiles (DELETE). */
export async function subagentsProfilesDelete(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const cwd = await validateCwd(body.cwd);
    const scope = validateScope(body.scope);
    if (typeof body.name !== "string") return { status: 400, body: { error: "name required" } };
    deleteSubagentProfile(cwd, scope, body.name);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    return errorBody(error);
  }
}

/** Port of app/api/subagents/settings (GET). */
export async function subagentsSettingsGet(): Promise<StatusBody> {
  try {
    const settings = readSubagentSettings();
    return { status: 200, body: { enabled: settings.builtInEnabled, maxConcurrent: settings.maxConcurrent } };
  } catch (error) {
    return errorBody(error, 500);
  }
}

/** Port of app/api/subagents/settings (PUT) — request-security checks are HTTP
 *  concerns; the typed IPC channel is only reachable from the trusted renderer. */
export async function subagentsSettingsPut(enabled: unknown, maxConcurrent?: unknown): Promise<StatusBody> {
  try {
    if (enabled === undefined && maxConcurrent === undefined) {
      return { status: 400, body: { error: "enabled or maxConcurrent is required" } };
    }
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return { status: 400, body: { error: "enabled must be a boolean" } };
    }
    if (maxConcurrent !== undefined && typeof maxConcurrent !== "number") {
      return { status: 400, body: { error: "maxConcurrent must be a number" } };
    }
    let settings = readSubagentSettings();
    if (enabled !== undefined) settings = writeBuiltInSubagentsEnabled(enabled);
    if (maxConcurrent !== undefined) settings = writeSubagentMaxConcurrent(maxConcurrent);
    return { status: 200, body: { enabled: settings.builtInEnabled, maxConcurrent: settings.maxConcurrent } };
  } catch (error) {
    return errorBody(error, 500);
  }
}
