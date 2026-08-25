import { execSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { connectProject } from "./api.js";
import { BRAND } from "./config.js";
import { mergedMcpConfig } from "./mcpConfig.js";
import { installedContent, readIfExists, rulesBlock, rulesTargets } from "./rules.js";

export interface InitOptions {
  code?: string;
  cursor: boolean;
  cwd?: string;
  /** Injected in tests; defaults to a terminal prompt. */
  ask?: (question: string) => Promise<string>;
  log?: (line: string) => void;
  error?: (line: string) => void;
}

export function detectProjectName(cwd: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { name?: string };
    if (pkg.name) return pkg.name.replace(/^@[^/]+\//, "");
  } catch {
    // No package.json, or an unreadable one — the directory name is fine.
  }
  return basename(cwd);
}

export function detectRepoName(cwd: string): string | undefined {
  try {
    const url = execSync("git remote get-url origin", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return /[:/]([^/:]+\/[^/]+?)(\.git)?$/.exec(url)?.[1];
  } catch {
    return undefined;
  }
}

async function promptForCode(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`Connect code (from the ${BRAND.name} dashboard): `)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Connect this repo.
 *
 * Every file this touches is snapshotted first and restored if any later step
 * fails, because a half-connected repo — an MCP config pointing at a project
 * that does not exist, or a rules block with no server behind it — is worse
 * than no connection at all.
 */
export async function runInit(options: InitOptions): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const log = options.log ?? ((line: string) => console.log(line));
  const fail = options.error ?? ((line: string) => console.error(line));

  const code = (options.code ?? (await (options.ask ?? promptForCode)(""))).trim();
  if (!code) {
    fail("A connect code is required. Get one from the dashboard's connect screen.");
    return 1;
  }

  const projectName = detectProjectName(cwd);
  const repoName = detectRepoName(cwd);
  const mcpPath = join(cwd, ".mcp.json");
  const cursorPath = join(cwd, ".cursor", "mcp.json");

  // Dry run first: fail on a malformed config before burning the connect code.
  try {
    mergedMcpConfig(readIfExists(mcpPath), "probe", ".mcp.json");
    if (options.cursor) mergedMcpConfig(readIfExists(cursorPath), "probe", ".cursor/mcp.json");
    rulesBlock();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const result = await connectProject({ code, projectName, repoName });
  if (!result.ok) {
    fail(result.error);
    if (result.code === "upgrade_required") {
      fail(`Upgrade: ${BRAND.name} dashboard → billing.`);
    } else if (result.code === "expired" || result.code === "invalid_token") {
      fail("Mint a fresh code on the dashboard connect screen and re-run init.");
    }
    return 1;
  }

  const { projectId, apiKey } = result;
  const snapshots: { path: string; previous: string | null }[] = [];
  const written: string[] = [];

  const writeTracked = (path: string, content: string) => {
    snapshots.push({ path, previous: readIfExists(path) });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    written.push(path);
  };

  try {
    writeTracked(
      join(cwd, BRAND.projectConfigFile),
      `${JSON.stringify({ projectId, projectName, keyPrefix: apiKey.slice(0, 16) }, null, 2)}\n`,
    );
    writeTracked(mcpPath, mergedMcpConfig(readIfExists(mcpPath), apiKey, ".mcp.json"));
    if (options.cursor) {
      writeTracked(cursorPath, mergedMcpConfig(readIfExists(cursorPath), apiKey, ".cursor/mcp.json"));
    }

    const block = rulesBlock();
    for (const target of rulesTargets(cwd)) {
      writeTracked(target, installedContent(readIfExists(target), block));
    }

    const gitignorePath = join(cwd, ".gitignore");
    const gitignore = readIfExists(gitignorePath) ?? "";
    const missing = [".mcp.json", ".cursor/mcp.json"].filter(
      (entry) => !gitignore.split("\n").some((line) => line.trim() === entry),
    );
    if (missing.length > 0) {
      const separator = gitignore === "" ? "" : gitignore.endsWith("\n") ? "" : "\n";
      writeTracked(
        gitignorePath,
        `${gitignore}${separator}\n# ${BRAND.cli}: these hold your project API key — never commit them\n${missing.join("\n")}\n`,
      );
    }
  } catch (err) {
    rollback(snapshots, fail);
    fail(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
    fail("All files from this run were restored. Fix the issue above and re-run init.");
    return 1;
  }

  log(`\nConnected ${projectName} to ${BRAND.name}.\n`);
  log("Files written:");
  for (const path of written) log(`  ${path.replace(`${cwd}/`, "")}`);
  log(
    `\nNote: .mcp.json holds this project's API key — it's been gitignored. Keep it out of version control.`,
  );
  log(`\nNo design system yet? Run \`npx ${BRAND.cli} extract-prompt\` and paste it into your agent.`);
  log(`Otherwise, try the laziest prompt you've got — e.g. "Make a pricing page".`);
  return 0;
}

function rollback(
  snapshots: { path: string; previous: string | null }[],
  fail: (line: string) => void,
): void {
  for (const snapshot of [...snapshots].reverse()) {
    try {
      if (readIfExists(snapshot.path) === snapshot.previous) continue;
      if (snapshot.previous === null) unlinkSync(snapshot.path);
      else writeFileSync(snapshot.path, snapshot.previous);
    } catch {
      fail(`  (could not restore ${snapshot.path} — check it manually)`);
    }
  }
}
