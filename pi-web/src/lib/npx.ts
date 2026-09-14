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
interface NpmRuntime {
  executable: string;
  cliPath: string;
}

type NpmCli = "npm" | "npx";

function existingNpmRuntime(nodeExecutable: string, cli: NpmCli): NpmRuntime | null {
  const nodeDir = dirname(nodeExecutable);
  const cliFile = `${cli}-cli.js`;
  const candidates = [
    // Windows MSI installer layout: node.exe and node_modules share a dir
    join(nodeDir, "node_modules", "npm", "bin", cliFile),
    // Unix layout: .../bin/node + .../lib/node_modules/npm/bin/{npm,npx}-cli.js
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", cliFile),
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

function findNpmRuntime(cli: NpmCli, env: NodeJS.ProcessEnv): NpmRuntime | null {
  const currentRuntime = existingNpmRuntime(execPath, cli);
  if (currentRuntime) return currentRuntime;

  const pathValue = env.PATH ?? env.Path ?? "";
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  for (const entry of pathValue.split(delimiter)) {
    if (!entry) continue;
    const runtime = existingNpmRuntime(join(entry, nodeName), cli);
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
function resolveNpmCliCommand(cli: NpmCli, env: NodeJS.ProcessEnv): string[] | undefined {
  const runtime = findNpmRuntime(cli, env);
  return runtime ? [runtime.executable, runtime.cliPath] : undefined;
}

async function runNpmCli(
  cli: NpmCli,
  args: string[],
  opts: RunNpxOptions,
): Promise<RunNpxResult> {
  const env = opts.env ?? process.env;
  const resolved = resolveNpmCliCommand(cli, env);
  if (!resolved && process.platform === "win32") {
    throw new Error(`Unable to locate npm's ${cli}-cli.js. Install Node.js with npm and add it to PATH.`);
  }

  const [command = cli, ...commandArgs] = resolved ?? [];
  return execFileAsync(command, [...commandArgs, ...args], {
    timeout: opts.timeout,
    cwd: opts.cwd,
    env,
  });
}

export async function runNpx(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  return runNpmCli("npx", args, opts);
}

export async function runNpm(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  return runNpmCli("npm", args, opts);
}
