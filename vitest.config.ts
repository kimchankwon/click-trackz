import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    server: { deps: { inline: ["convex-test"] } },
    projects: [
      { extends: true, test: { name: "app", include: ["src/**/*.test.ts"], environment: "node" } },
      { extends: true, test: { name: "convex", include: ["convex/**/*.test.ts"], environment: "edge-runtime" } },
    ],
  },
});
