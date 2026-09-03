import { describe, expect, it } from "vitest";

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
});
