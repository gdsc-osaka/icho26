import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "~/workers", replacement: path.resolve(__dirname, "workers") },
      { find: "~", replacement: path.resolve(__dirname, "app") },
    ],
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "app/**/*.test.ts", "app/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    environment: "node",
  },
});
