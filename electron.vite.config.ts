import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirrors the version injection the retired next.config.ts did via `env`.
const piWebDir = resolve(__dirname, "pi-web");
const appVersion = JSON.parse(
  readFileSync(resolve(piWebDir, "package.json"), "utf8"),
).version as string;
let piVersion = "unknown";
try {
  piVersion = JSON.parse(
    readFileSync(
      resolve(__dirname, "node_modules/@earendil-works/pi-coding-agent/package.json"),
      "utf8",
    ),
  ).version as string;
} catch {
  /* pi package not installed yet */
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { "@shared": resolve(__dirname, "src/shared") },
    },
    build: {
      rollupOptions: {
        input: { main: resolve(__dirname, "electron/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { preload: resolve(__dirname, "electron/preload/index.ts") },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "pi-web"),
    plugins: [react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
      "process.env.NEXT_PUBLIC_APP_VERSION": JSON.stringify(appVersion),
      "process.env.NEXT_PUBLIC_PI_VERSION": JSON.stringify(piVersion),
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "pi-web"),
        "@shared": resolve(__dirname, "src/shared"),
        "next/navigation": resolve(__dirname, "pi-web/src/next-navigation.ts"),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "pi-web/index.html") } },
      outDir: resolve(__dirname, "out/renderer"),
    },
  },
});
