import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node20",
  // firebase-admin resolves its own internals at runtime; bundling it breaks that.
  external: ["firebase-admin", "stripe"],
});
