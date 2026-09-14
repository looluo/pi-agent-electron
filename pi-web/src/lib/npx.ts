import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { delimiter, dirname, join } from "path";
import { execPath } from "process";

const execFileAsync = promisify(execFile);

/**
 * Locate `npx-cli.js` shipped with the running Node.js installation.
 *
 * On Windows the `npx` on PATH is actually `npx.cmd`, which Node.js (since
 * 20.12 due to CVE-2024-27980) refuses to spawn from `execFile`/`spawn`
 * without `shell: true`. Going through a shell reintroduces quoting bugs for
 * user-supplied args. Instead we find the real `npx-cli.js` and invoke it
 * directly via its Node.js installation. Packaged Electron apps must search
 * PATH because `process.execPath` points to the app executable, not Node.js.
 */
interface NpxRuntime {
  executable: string;
  cliPath: string;
}

function existingNpxRuntime(nodeExecutable: string): NpxRuntime | null {
  const nodeDir = dirname(nodeExecutable);
  const candidates = [
    // Windows MSI installer layout: node.exe and node_modules share a dir
    join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"),
    // Unix layout: .../bin/node + .../lib/node_modules/npm/bin/npx-cli.js
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js"),
  ];
  for (const cliPath of candidates) {
    try {
      if (existsSync(nodeExecutable) && existsSync(cliPath)) {
        return { executable: nodeExecutable, cliPath };
      }
    } catch {
      // ignore inaccessible PATH entries
    }
  }
  return null;
}

function findNpxRuntime(env: NodeJS.ProcessEnv): NpxRuntime | null {
  const currentRuntime = existingNpxRuntime(execPath);
  if (currentRuntime) return currentRuntime;

  const pathValue = env.PATH ?? env.Path ?? "";
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  for (const entry of pathValue.split(delimiter)) {
    if (!entry) continue;
    const runtime = existingNpxRuntime(join(entry, nodeName));
    if (runtime) return runtime;
  }
  return null;
}

export interface RunNpxOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface RunNpxResult {
  stdout: string;
  stderr: string;
}

/**
 * Cross-platform wrapper for invoking `npx <args>` without ever using a
 * shell, so user-controlled arguments are never interpreted as shell syntax.
 */
export async function runNpx(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  const env = opts.env ?? process.env;
  const runtime = findNpxRuntime(env);
  if (!runtime && process.platform === "win32") {
    throw new Error("Unable to locate npm's npx-cli.js. Install Node.js with npm and add it to PATH.");
  }

  const command = runtime?.executable ?? "npx";
  const commandArgs = runtime ? [runtime.cliPath, ...args] : args;
  return execFileAsync(command, commandArgs, {
    timeout: opts.timeout,
    cwd: opts.cwd,
    env,
  });
}
