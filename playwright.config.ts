import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Electron E2E: launch the packaged-style app from the built out/ tree.
 * No webServer — each spec launches Electron via _electron.launch.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    // consumed by the launcher helper
    baseURL: "http://127.0.0.1:0",
  },
  outputDir: "./tests/.artifacts",
});
