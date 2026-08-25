import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against source, not dist, so `pnpm test` never needs a build first.
    alias: {
      "@tokenwell/core/fixtures/clearGlass": src("./packages/core/src/fixtures/clearGlass.ts"),
      "@tokenwell/core/schema": src("./packages/core/src/schema.ts"),
      "@tokenwell/core": src("./packages/core/src/index.ts"),
      "@tokenwell/mcp": src("./packages/mcp/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "functions/test/**/*.test.ts"],
    environment: "node",
  },
});
