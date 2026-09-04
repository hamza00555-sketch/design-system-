import { describe, expect, it } from "vitest";
import { AGENT_PATHS } from "../src/router.js";

/**
 * The plain-HTTP surface exists so an agent handed a URL and a key in a prompt
 * can push and verify with one request — no MCP server wired up, no CLI, no
 * terminal. These check the shape of that contract; the behaviour underneath is
 * the same code the MCP tools call, tested in packages/mcp.
 */
describe("the REST surface's contract", () => {
  it("accepts the system either wrapped or bare", () => {
    // The router reads `body.system ?? body`, because an agent told to send
    // {"system": …} and one that sends the system itself are both being
    // reasonable, and refusing one of them teaches nothing.
    const wrapped = { system: { meta: { name: "X" } } };
    const bare = { meta: { name: "X" } };
    expect(wrapped.system ?? wrapped).toEqual(bare);
    expect((bare as { system?: unknown }).system ?? bare).toEqual(bare);
  });

  /**
   * These four used to be matched by a `/api/systems/` prefix, which meant the
   * team's own /api/systems routes were swallowed by the agent's key check and
   * could never be reached by a signed-in person. The set is the fix, so the
   * membership of the set is what is worth pinning.
   */
  it("routes exactly the four agent paths by project key", () => {
    expect([...AGENT_PATHS].sort()).toEqual([
      "/api/systems/current",
      "/api/systems/push",
      "/api/systems/screens",
      "/api/systems/verify",
    ]);
  });

  it("leaves the team's own systems routes to the signed-in path", () => {
    expect(AGENT_PATHS.has("/api/systems/create")).toBe(false);
  });
});
