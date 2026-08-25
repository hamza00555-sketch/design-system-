import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../src/init.js";
import { installedContent, rulesBlock, START, END } from "../src/rules.js";
import { mergedMcpConfig } from "../src/mcpConfig.js";

let cwd: string;
const logs: string[] = [];
const errors: string[] = [];

const init = (options: { code?: string; cursor?: boolean } = {}) =>
  runInit({
    code: options.code ?? "ABCD-2345",
    cursor: options.cursor ?? false,
    cwd,
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
  });

const read = (name: string) => readFileSync(join(cwd, name), "utf8");

function stubConnect(response: { status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "tokenwell-"));
  logs.length = 0;
  errors.length = 0;
  stubConnect({ status: 201, body: { projectId: "p1", apiKey: "tw_live_abcdefghijklmnop" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(cwd, { recursive: true, force: true });
});

describe("a clean repo", () => {
  it("writes every file the agent needs", async () => {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@acme/web" }));
    expect(await init()).toBe(0);

    expect(JSON.parse(read(".tokenwell.json"))).toEqual({
      projectId: "p1",
      projectName: "web",
      keyPrefix: "tw_live_abcdefgh",
    });

    const mcp = JSON.parse(read(".mcp.json"));
    expect(mcp.mcpServers.tokenwell.type).toBe("http");
    expect(mcp.mcpServers.tokenwell.headers.Authorization).toBe(
      "Bearer tw_live_abcdefghijklmnop",
    );

    expect(read("CLAUDE.md")).toContain("get_design_system");
    expect(read("AGENTS.md")).toContain("get_design_system");
  });

  it("gitignores the files that hold the key", async () => {
    await init();
    const gitignore = read(".gitignore");
    expect(gitignore).toContain(".mcp.json");
    expect(gitignore).toContain(".cursor/mcp.json");
  });

  it("writes Cursor's config only when asked", async () => {
    await init();
    expect(existsSync(join(cwd, ".cursor", "mcp.json"))).toBe(false);

    rmSync(cwd, { recursive: true, force: true });
    cwd = mkdtempSync(join(tmpdir(), "tokenwell-"));
    await init({ cursor: true });
    expect(JSON.parse(read(".cursor/mcp.json")).mcpServers.tokenwell).toBeDefined();
  });
});

describe("a repo that already has things in it", () => {
  it("keeps other MCP servers", async () => {
    writeFileSync(
      join(cwd, ".mcp.json"),
      JSON.stringify({ mcpServers: { github: { type: "http", url: "https://example.com" } } }),
    );
    await init();
    const mcp = JSON.parse(read(".mcp.json"));
    expect(mcp.mcpServers.github.url).toBe("https://example.com");
    expect(mcp.mcpServers.tokenwell).toBeDefined();
  });

  it("leaves the user's CLAUDE.md content untouched", async () => {
    writeFileSync(join(cwd, "CLAUDE.md"), "# House rules\n\nRun the tests before pushing.\n");
    await init();
    const claude = read("CLAUDE.md");
    expect(claude).toContain("Run the tests before pushing.");
    expect(claude.indexOf("# House rules")).toBeLessThan(claude.indexOf(START));
  });

  it("replaces its own block instead of stacking a second one", async () => {
    await init();
    const first = read("CLAUDE.md");
    await init();
    const second = read("CLAUDE.md");
    expect(second).toBe(first);
    expect(second.split(START)).toHaveLength(2);
  });

  it("does not add a gitignore entry twice", async () => {
    writeFileSync(join(cwd, ".gitignore"), "node_modules\n.mcp.json\n.cursor/mcp.json\n");
    await init();
    expect(read(".gitignore").match(/^\.mcp\.json$/gm)).toHaveLength(1);
  });
});

describe("when something goes wrong", () => {
  it("refuses a malformed .mcp.json before burning the code", async () => {
    writeFileSync(join(cwd, ".mcp.json"), "{ not json");
    expect(await init()).toBe(1);
    expect(errors.join("\n")).toContain("not valid JSON");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(existsSync(join(cwd, ".tokenwell.json"))).toBe(false);
  });

  it("explains an expired code and how to get another", async () => {
    stubConnect({ status: 401, body: { error: "That code has expired.", code: "expired" } });
    expect(await init()).toBe(1);
    expect(errors.join("\n")).toContain("Mint a fresh code");
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });

  it("points a free team at billing when the plan is the blocker", async () => {
    stubConnect({
      status: 403,
      body: { error: "The free plan covers one project.", code: "upgrade_required" },
    });
    expect(await init()).toBe(1);
    expect(errors.join("\n")).toContain("billing");
  });

  it("requires a code", async () => {
    expect(await init({ code: "  " })).toBe(1);
    expect(errors.join("\n")).toContain("connect code is required");
  });

  it("restores every touched file when a write fails midway", async () => {
    writeFileSync(join(cwd, "CLAUDE.md"), "# House rules\n");
    // A directory where AGENTS.md must go makes the write fail.
    mkdirSync(join(cwd, "AGENTS.md"));

    expect(await init()).toBe(1);
    expect(read("CLAUDE.md")).toBe("# House rules\n");
    expect(existsSync(join(cwd, ".tokenwell.json"))).toBe(false);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
    expect(errors.join("\n")).toContain("were restored");
  });
});

describe("the rules block", () => {
  it("tells the agent to consult before and verify after", () => {
    const block = rulesBlock();
    expect(block).toContain("Before ANY visual or UI work");
    expect(block).toContain("Immediately after writing or editing any UI file");
    expect(block.startsWith(START)).toBe(true);
    expect(block.endsWith(END)).toBe(true);
  });

  it("appends to a file that has no block yet", () => {
    const out = installedContent("# Notes\n", "BLOCK");
    expect(out).toBe("# Notes\n\nBLOCK\n");
  });

  it("swaps a block in place, keeping what surrounds it", () => {
    const existing = `before\n${START}\nold\n${END}\nafter\n`;
    const out = installedContent(existing, `${START}\nnew\n${END}`);
    expect(out).toBe(`before\n${START}\nnew\n${END}\nafter\n`);
  });
});

describe("mcp config merging", () => {
  it("rejects a JSON array", () => {
    expect(() => mergedMcpConfig("[]", "k", ".mcp.json")).toThrow("must contain a JSON object");
  });

  it("treats an empty file as a fresh start", () => {
    expect(JSON.parse(mergedMcpConfig("", "k", ".mcp.json")).mcpServers.tokenwell).toBeDefined();
  });
});
