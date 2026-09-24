import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { mergePathEntries, parseShellEnvPath, staticMacToolDirs } from "@/lib/unix-path";

/**
 * Repair the main-process PATH for GUI launches.
 *
 * Finder/Dock launches inherit launchd's minimal PATH, so `spawn("npm", …)`
 * inside DefaultPackageManager (plugin install/update) — and any other
 * direct child spawn — fails with ENOENT. Terminal launches are unaffected,
 * which is why e2e/probes that inherit a full PATH never see this.
 *
 * Two layers, mirroring how the terminal tabs already work (they spawn
 * `$SHELL -l` and heal their own PATH):
 *
 *  1. `applyStaticToolDirsToPath()` — synchronous, run before app ready:
 *     appends the well-known Homebrew/volta/pnpm dirs. Covers the common
 *     case instantly.
 *  2. `enrichPathFromLoginShell()` — fire-and-forget async: captures
 *     `$SHELL -ilc env` (sources .zprofile/.zshrc/etc., so nvm and custom
 *     prefixes land too) and merges what's missing. Best-effort: timeout,
 *     spawn failure, and unparseable output all fall back to layer 1.
 *
 * Layer 2's completeness heuristic must judge the PATH as it was *before*
 * layer 1 ran: layer 1 itself appends the well-known dirs that the
 * heuristic treats as proof of a full shell PATH, so judging the repaired
 * PATH would always short-circuit the capture — leaving nvm-only setups
 * (npm exists nowhere on the static dirs) with no npm at all.
 *
 * The login-shell capture takes real time (shell init files: nvm, shell
 * hooks, …), so npm-spawning surfaces must not race it — call
 * `repairPathAtStartup()` once at boot and `await waitForPathRepair()`
 * before the first spawn.
 */

const LOGIN_SHELL_TIMEOUT_MS = 4_000;
/** Upper bound for waiting on the login-shell capture. The capture itself
 *  times out at LOGIN_SHELL_TIMEOUT_MS, but a grandchild holding the stdout
 *  pipe open can keep `close` from ever firing, so waiters race this bound
 *  instead of trusting the capture to settle. */
const PATH_REPAIR_WAIT_MS = LOGIN_SHELL_TIMEOUT_MS + 1_000;

function isDarwin(): boolean {
  return process.platform === "darwin";
}

/** PATH as it was before any repair, captured on first touch (module-level
 *  state: both layers run once, from the same startup sequence). */
let preRepairPath: string | null = null;

/** The in-flight (or settled) layer-2 enrichment, started by
 *  `repairPathAtStartup()`. Waited on by `waitForPathRepair()`. */
let enrichTask: Promise<void> = Promise.resolve();

function rememberPreRepairPath(): void {
  if (preRepairPath === null) preRepairPath = process.env.PATH ?? "";
}

/** Synchronously append existing well-known tool dirs to process.env.PATH. */
export function applyStaticToolDirsToPath(): void {
  if (!isDarwin()) return;
  rememberPreRepairPath();
  const dirs = staticMacToolDirs(homedir()).filter((dir) => {
    try {
      return existsSync(dir);
    } catch {
      return false;
    }
  });
  if (dirs.length === 0) return;
  process.env.PATH = mergePathEntries(process.env.PATH ?? "", dirs.join(":"));
}

function pathLooksComplete(pathEnv: string | undefined): boolean {
  if (!pathEnv) return false;
  const entries = new Set(pathEnv.split(":"));
  // A terminal launch already has the shell's full PATH; one hit on any
  // well-known dir (or an nvm-style prefix) is enough to skip the capture.
  // Must be evaluated against the PRE-repair PATH — see the header comment.
  return (
    staticMacToolDirs(homedir()).some((dir) => entries.has(dir)) ||
    [...entries].some((entry) => entry.includes("/.nvm/"))
  );
}

async function captureLoginShellPath(): Promise<string | null> {
  const shell = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : "/bin/zsh";
  return new Promise((resolve) => {
    const child = spawn(shell, ["-ilc", "env"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), LOGIN_SHELL_TIMEOUT_MS);
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk;
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(parseShellEnvPath(out));
    });
    // Belt-and-braces: if `close` never fires (a background grandchild
    // spawned by shell init inherits and holds the stdout pipe open), the
    // kill timer alone is not enough to settle this promise.
    const settle = setTimeout(() => resolve(parseShellEnvPath(out)), LOGIN_SHELL_TIMEOUT_MS);
    child.on("close", () => clearTimeout(settle));
  });
}

/** Best-effort: merge the login shell's PATH into process.env.PATH. */
export async function enrichPathFromLoginShell(): Promise<void> {
  if (!isDarwin()) return;
  if (pathLooksComplete(preRepairPath ?? process.env.PATH)) return;
  const captured = await captureLoginShellPath();
  if (captured) {
    process.env.PATH = mergePathEntries(process.env.PATH ?? "", captured);
  }
}

/** One-shot startup wiring: layer 1 synchronously, layer 2 in background. */
export function repairPathAtStartup(): void {
  if (!isDarwin()) return;
  applyStaticToolDirsToPath();
  enrichTask = enrichPathFromLoginShell();
}

/**
 * Wait (bounded) for the background PATH repair to settle. Call before the
 * first npm spawn (plugin install/update/check). Best-effort by design:
 * on timeout the caller proceeds with whatever PATH layer 1 produced.
 */
export async function waitForPathRepair(): Promise<void> {
  await Promise.race([
    enrichTask,
    new Promise<void>((resolve) => setTimeout(resolve, PATH_REPAIR_WAIT_MS)),
  ]);
}
