import { constants, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Keep real credentials/configuration available to the live-model tests,
 * but never write their sessions, package installs or UI state into the user's
 * agent home. Playwright calls the returned cleanup even when a test fails. */
export default async function setup(): Promise<() => void> {
  const { getAgentDir } = await import("@earendil-works/pi-coding-agent");
  const source = getAgentDir();
  const directory = mkdtempSync(join(tmpdir(), "pi-e2e-"));
  const agentDir = join(directory, "agent");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousTestDir = process.env.PI_E2E_TEST_DIR;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    if (previousTestDir === undefined) delete process.env.PI_E2E_TEST_DIR;
    else process.env.PI_E2E_TEST_DIR = previousTestDir;
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    mkdirSync(agentDir, { mode: 0o700 });
    // Copy installed packages too: discovering extension providers must not
    // reinstall them from the network on the first test. No sessions are copied.
    for (const name of ["auth.json", "models.json", "settings.json", "npm"]) {
      const path = join(source, name);
      if (existsSync(path)) cpSync(path, join(agentDir, name), { recursive: true, mode: constants.COPYFILE_FICLONE });
    }
    process.env.PI_CODING_AGENT_DIR = agentDir;
    process.env.PI_E2E_TEST_DIR = directory;
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}
