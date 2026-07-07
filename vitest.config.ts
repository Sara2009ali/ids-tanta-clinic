import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal config for pure-logic unit tests (no DOM/rendering needed).
// Mirrors the "@/*" -> "./src/*" path alias from tsconfig.json.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
