import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/schema.ts", "src/fixtures/clearGlass.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node20",
});
