import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { API_BASE, BRAND } from "./config.js";
import { runInit } from "./init.js";
import { extractPrompt } from "./rules.js";

const program = new Command();

program
  .name(BRAND.cli)
  .description("Serve your design system to every AI agent on every project.")
  .version("0.1.0");

program
  .command("init")
  .description(`Connect this repo to your ${BRAND.name} team (MCP + agent rules).`)
  .option("--code <code>", "connect code from the dashboard")
  .option("--cursor", "also write Cursor's MCP config (.cursor/mcp.json)")
  .action(async (options: { code?: string; cursor?: boolean }) => {
    process.exitCode = await runInit({ code: options.code, cursor: options.cursor ?? false });
  });

program
  .command("whoami")
  .description("Show this repo's connection.")
  .action(() => {
    const configPath = join(process.cwd(), BRAND.projectConfigFile);
    if (!existsSync(configPath)) {
      console.log(`Not connected. Run \`npx ${BRAND.cli} init\` to connect this repo.`);
      return;
    }
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, string>;
    console.log(`Project:    ${config.projectName ?? "unknown"}`);
    console.log(`Project id: ${config.projectId ?? "unknown"}`);
    console.log(`Key prefix: ${config.keyPrefix ?? "unknown"}…`);
    console.log(`Endpoint:   ${API_BASE}`);
  });

program
  .command("extract-prompt")
  .description("Print the prompt that builds your design system from this repo.")
  .action(() => {
    console.log(extractPrompt());
  });

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
