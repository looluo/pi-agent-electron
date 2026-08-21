import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5183,
    strictPort: true,
    host: "127.0.0.1",
  },
});
