import { execFile } from "child_process";
import { promisify } from "util";
import { nodeCliInvocation, type NodeCliName } from "./node-cli";

const execFileAsync = promisify(execFile);

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
 * Run one of npm's bundled CLI scripts (`npm`/`npx`) without ever using a
 * shell, so user-controlled arguments are never interpreted as shell syntax.
 * See `lib/node-cli.ts` for why the bundled `<name>-cli.js` is preferred over
 * the `npm`/`npx` (or `.cmd`) shims on PATH.
 */
async function runNodeCli(
  cli: NodeCliName,
  args: string[],
  opts: RunNpxOptions,
): Promise<RunNpxResult> {
  const env = opts.env ?? process.env;
  const { command, args: commandArgs } = nodeCliInvocation(cli, args, { env });
  if (command === cli && process.platform === "win32") {
    // A packaged Electron app has no npm.cmd shim to fall back to; a bare
    // `npm`/`npx` would only ever fail with `spawn ENOENT`.
    throw new Error(`Unable to locate npm's ${cli}-cli.js. Install Node.js with npm and add it to PATH.`);
  }
  return execFileAsync(command, commandArgs, {
    timeout: opts.timeout,
    cwd: opts.cwd,
    env,
  });
}

export async function runNpx(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  return runNodeCli("npx", args, opts);
}

export async function runNpm(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  return runNodeCli("npm", args, opts);
}
