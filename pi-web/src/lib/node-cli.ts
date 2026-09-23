import { existsSync } from "fs";
import { delimiter, dirname, join } from "path";
import { execPath } from "process";

export type NodeCliName = "npm" | "npx";

export interface NodeCliLookupOptions {
  /** Directory holding the running `node` binary. Defaults to the real one. */
  nodeDir?: string;
  /** Probe used to test a candidate path, injectable for tests. */
  fileExists?: (path: string) => boolean;
  /**
   * Environment searched for a Node.js runtime when `process.execPath` is not
   * one (packaged Electron apps run as the app executable, not Node.js).
   * Defaults to `process.env`.
   */
  env?: NodeJS.ProcessEnv;
}

/**
 * Candidate `<name>-cli.js` locations for a Node.js installation directory.
 */
function nodeCliCandidates(nodeDir: string, name: NodeCliName): string[] {
  return [
    // Windows MSI installer layout: node.exe and node_modules share a dir
    join(nodeDir, "node_modules", "npm", "bin", `${name}-cli.js`),
    // Unix layout: .../bin/node + .../lib/node_modules/npm/bin/<name>-cli.js
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", `${name}-cli.js`),
  ];
}

/**
 * Locate the `<name>-cli.js` shipped with the running Node.js installation.
 *
 * On Windows the `npm`/`npx` on PATH are actually `npm.cmd`/`npx.cmd`, which
 * Node.js (since 20.12, due to CVE-2024-27980) refuses to spawn from
 * `execFile`/`spawn` without `shell: true` — the failure mode is a bare
 * `spawn npm ENOENT` on every call. Going through a shell reintroduces quoting
 * bugs for user-supplied args. Instead we find the real CLI script and invoke
 * it directly through a `node` binary, which works identically on every
 * platform and needs no shell.
 */
export function findNodeCliScript(
  name: NodeCliName,
  options: NodeCliLookupOptions = {},
): string | null {
  const nodeDir = options.nodeDir ?? dirname(execPath);
  const fileExists = options.fileExists ?? existsSync;
  for (const candidate of nodeCliCandidates(nodeDir, name)) {
    try {
      if (fileExists(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

export interface NodeCliRuntime {
  executable: string;
  cliPath: string;
}

/**
 * Resolve a `node` binary plus its bundled `<name>-cli.js`.
 *
 * The running `process.execPath` is tried first, but a packaged Electron app's
 * executable ships no npm CLI, so PATH is then scanned for a real Node.js
 * installation to run the CLI script with.
 */
export function findNodeCliRuntime(
  name: NodeCliName,
  options: NodeCliLookupOptions = {},
): NodeCliRuntime | null {
  const fileExists = options.fileExists ?? existsSync;
  const env = options.env ?? process.env;
  const executables = [execPath];
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  const pathValue = env.PATH ?? env.Path ?? "";
  for (const entry of pathValue.split(delimiter)) {
    if (entry) executables.push(join(entry, nodeName));
  }
  for (const executable of executables) {
    try {
      if (!fileExists(executable)) continue;
      for (const cliPath of nodeCliCandidates(dirname(executable), name)) {
        if (fileExists(cliPath)) return { executable, cliPath };
      }
    } catch {
      // ignore inaccessible PATH entries
    }
  }
  return null;
}

export interface NodeCliInvocation {
  command: string;
  args: string[];
}

/**
 * `execFile`-spawnable invocation of a Node.js CLI, never routed through a
 * shell. Falls back to the bare command name when no bundled CLI script is
 * found, so behavior is unchanged on installs that ship none.
 *
 * When `options.nodeDir` is given (tests), the CLI script next to that Node.js
 * is run through `process.execPath`. Otherwise the resolution of
 * `findNodeCliRuntime` is used, which may substitute a PATH-scanned `node`.
 */
export function nodeCliInvocation(
  name: NodeCliName,
  args: string[],
  options: NodeCliLookupOptions = {},
): NodeCliInvocation {
  if (options.nodeDir) {
    const script = findNodeCliScript(name, options);
    return script
      ? { command: execPath, args: [script, ...args] }
      : { command: name, args };
  }
  const runtime = findNodeCliRuntime(name, options);
  return runtime
    ? { command: runtime.executable, args: [runtime.cliPath, ...args] }
    : { command: name, args };
}
