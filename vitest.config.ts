import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against source, not dist, so `pnpm test` never needs a build first.
    alias: {
      "@miswadah/core/fixtures/clearGlass": src("./packages/core/src/fixtures/clearGlass.ts"),
      "@miswadah/core/schema": src("./packages/core/src/schema.ts"),
      "@miswadah/core": src("./packages/core/src/index.ts"),
      "@miswadah/mcp": src("./packages/mcp/src/index.ts"),
      "@miswadah/api": src("./packages/api/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});
