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
 */

const LOGIN_SHELL_TIMEOUT_MS = 4_000;

function isDarwin(): boolean {
  return process.platform === "darwin";
}

/** Synchronously append existing well-known tool dirs to process.env.PATH. */
export function applyStaticToolDirsToPath(): void {
  if (!isDarwin()) return;
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
  });
}

/** Best-effort: merge the login shell's PATH into process.env.PATH. */
export async function enrichPathFromLoginShell(): Promise<void> {
  if (!isDarwin()) return;
  if (pathLooksComplete(process.env.PATH)) return;
  const captured = await captureLoginShellPath();
  if (captured) {
    process.env.PATH = mergePathEntries(process.env.PATH ?? "", captured);
  }
}
