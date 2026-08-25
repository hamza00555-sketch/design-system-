import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  clean: true,
  target: "node20",
  // The rules block and extraction prompt ship as files so they can be read
  // (and diffed) without digging through a bundle.
  publicDir: "assets",
  banner: { js: "#!/usr/bin/env node" },
});
