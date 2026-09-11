import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { tmpdir } from "node:os";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { allowFileRoot } from "@/lib/file-access";
import { getRpcSession, getRunningRpcSessionIds, setRpcSessionTools, startRpcSession, type AgentSessionWrapper } from "@/lib/rpc-manager";
import { getSessionListVersion, invalidateSessionListCache, resolveSessionPath } from "@/lib/session-reader";
import { renewSessionLivenessLeases } from "@/lib/session-liveness";
import {
  MAX_INLINE_BASH_OUTPUT_BYTES,
  openRegularFileNoFollow,
  readUtf8FileWithinLimit,
  resolveBashOutputPath,
} from "@/lib/bash-output";
import { isBashOutputPathReferencedBySession } from "@/lib/session-file-references";

const THINKING_LEVELS = new Set<ThinkingLevel>(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function parseThinkingLevel(value: unknown): ThinkingLevel | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && THINKING_LEVELS.has(value as ThinkingLevel)) {
    return value as ThinkingLevel;
  }
  throw new Error(`Invalid thinking level: ${String(value)}`);
}

export type AgentNewInput = {
  cwd: string;
  type?: string;
  provider?: string;
  modelId?: string;
  toolNames?: string[];
  thinkingLevel?: unknown;
  [key: string]: unknown;
};

export type IpcFailure = { ok: false; error: string; code?: string; accepted?: boolean; notFound?: boolean };
export type IpcSuccess<T> = { ok: true; data: T };
export type IpcResult<T> = IpcSuccess<T> | IpcFailure;

/** Port of app/api/agent/new (POST). */
export async function agentNew(body: AgentNewInput): Promise<IpcResult<{
  sessionId: string;
  data: unknown;
  model: { provider: string; modelId: string } | null;
  thinkingLevel?: string;
}>> {
  const commandType = typeof body.type === "string" ? body.type : undefined;
  const { cwd, ...command } = body;

  if (!cwd || typeof cwd !== "string") {
    return {
      ok: false,
      error: "cwd is required",
      ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
    };
  }
  if (!existsSync(cwd)) {
    return {
      ok: false,
      error: `Directory does not exist: ${cwd}`,
      ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
    };
  }

  try {
    const { provider, modelId, toolNames, thinkingLevel, ...promptCommand } = command as {
      provider?: string; modelId?: string; toolNames?: string[]; thinkingLevel?: unknown; type?: string; [key: string]: unknown;
    };
    if ((provider && !modelId) || (!provider && modelId)) {
      throw new Error("provider and modelId must be provided together");
    }
    const explicitThinkingLevel = parseThinkingLevel(thinkingLevel);

    const tempKey = `__new__${randomUUID()}`;
    const { session, realSessionId } = await startRpcSession(tempKey, "", cwd, {
      ...(toolNames ? { toolNames } : {}),
      ...(provider && modelId ? { initialModel: { provider, modelId } } : {}),
      ...(explicitThinkingLevel ? { thinkingLevel: explicitThinkingLevel } : {}),
    });

    // Keep the files-route allowed-roots cache in sync so the new cwd is
    // immediately readable (parity with the retired route).
    allowFileRoot(cwd);
    invalidateSessionListCache();

    const state = await session.send({ type: "get_state" }) as {
      model?: { id: string; provider: string };
      thinkingLevel?: string;
    };

    if (promptCommand.type === "ensure_session") {
      return {
        ok: true,
        data: {
          sessionId: realSessionId,
          data: null,
          model: state.model ? { provider: state.model.provider, modelId: state.model.id } : null,
          thinkingLevel: state.thinkingLevel,
        },
      };
    }

    let result: unknown = null;
    let promptAccepted = false;
    try {
      result = await session.send(promptCommand);
      promptAccepted = promptCommand.type === "prompt";
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(commandType === "prompt" && !promptAccepted
          ? { code: "prompt_rejected", accepted: false }
          : {}),
      };
    }

    return {
      ok: true,
      data: {
        sessionId: realSessionId,
        data: result,
        model: state.model ? { provider: state.model.provider, modelId: state.model.id } : null,
        thinkingLevel: state.thinkingLevel,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
    };
  }
}

/** Port of app/api/agent/[id] (POST) — command dispatch. */
export async function agentCommand(
  sessionId: string,
  command: Record<string, unknown>,
): Promise<IpcResult<unknown>> {
  const commandType = typeof command.type === "string" ? command.type : undefined;

  const existing = getRpcSession(sessionId);

  // set_tools goes through setRpcSessionTools instead of the wrapper switch:
  // crossing the chat-only boundary recreates the session (upstream a5738cf
  // intercepts the same command before the live fast path).
  if (commandType === "set_tools") {
    const filePath = existing?.sessionFile || await resolveSessionPath(sessionId) || undefined;
    if (!existing?.isAlive() && !filePath) {
      return {
        ok: false,
        error: "Session not found",
        notFound: true,
      };
    }
    try {
      const changed = await setRpcSessionTools(sessionId, filePath, command.toolNames);
      return { ok: true, data: { sessionId: changed.sessionId, recreated: changed.recreated } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (existing?.isAlive()) {
    try {
      const result = await existing.send(command);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
      };
    }
  }

  const filePath = await resolveSessionPath(sessionId);
  if (!filePath) {
    return {
      ok: false,
      error: "Session not found",
      notFound: true,
      ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
    };
  }

  try {
    const { session } = await startRpcSession(sessionId, filePath, undefined);
    const result = await session.send(command);
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(commandType === "prompt" ? { code: "prompt_rejected", accepted: false } : {}),
    };
  }
}

/** Port of app/api/agent/[id] (GET) — running + state snapshot. */
export async function agentState(sessionId: string): Promise<{ running: boolean; state?: unknown }> {
  const session: AgentSessionWrapper | undefined = getRpcSession(sessionId);
  if (!session || !session.isAlive()) {
    // Parity with the route: a known-but-idle file reports running:false only
    // after resolving; unknown sessions also report running:false.
    return { running: false };
  }
  const state = await session.send({ type: "get_state" });
  return { running: true, state };
}

/** Port of app/api/agent/[id]/lease (POST) — renew selected-session leases. */
export function agentLease(sessionId: string): { renewed: number } {
  return { renewed: renewSessionLivenessLeases(sessionId) };
}

/** Port of app/api/agent/running (GET). */
export function agentRunningIds(): { sessionListVersion: number; runningSessionIds: string[] } {
  return {
    sessionListVersion: getSessionListVersion(),
    runningSessionIds: getRunningRpcSessionIds(),
  };
}

/** Port of app/api/agent/[id]/bash-output (GET, inline variant). */
export async function agentBashOutput(
  sessionId: string,
  path: string,
): Promise<IpcResult<{ output: string }>> {
  const resolved = resolveBashOutputPath(path, tmpdir());
  if (!resolved) {
    return { ok: false, error: "invalid path" };
  }
  if (!await isBashOutputPathReferencedBySession(resolved, sessionId)) {
    return { ok: false, error: "forbidden" };
  }
  try {
    const result = await readUtf8FileWithinLimit(resolved);
    if (result.tooLarge) {
      return {
        ok: false,
        error: `Full output is too large to display (limit ${MAX_INLINE_BASH_OUTPUT_BYTES} bytes)`,
      };
    }
    return { ok: true, data: { output: result.content } };
  } catch {
    return { ok: false, error: "full output unavailable" };
  }
}

/** Download variant — returns full content for the renderer to save as a blob. */
export async function agentBashOutputDownload(
  sessionId: string,
  path: string,
): Promise<IpcResult<{ output: string }>> {
  const resolved = resolveBashOutputPath(path, tmpdir());
  if (!resolved) return { ok: false, error: "invalid path" };
  if (!await isBashOutputPathReferencedBySession(resolved, sessionId)) {
    return { ok: false, error: "forbidden" };
  }
  try {
    const { handle } = await openRegularFileNoFollow(resolved);
    try {
      const { read } = await import("node:fs");
      const content = await new Promise<string>((resolve, reject) => {
        let text = "";
        const stream = handle.createReadStream({ encoding: "utf8" });
        stream.on("data", (chunk: string) => { text += chunk; });
        stream.on("end", () => resolve(text));
        stream.on("error", reject);
      });
      void read;
      return { ok: true, data: { output: content } };
    } finally {
      await handle.close();
    }
  } catch {
    return { ok: false, error: "full output unavailable" };
  }
}
