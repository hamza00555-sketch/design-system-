import { describe, expect, it } from "vitest";
import { clearGlass } from "../src/fixtures/clearGlass.js";
import { toStylePrompt } from "../src/stylePrompt.js";
import { parseDesignSystem } from "../src/schema.js";

describe("toStylePrompt", () => {
  const prompt = toStylePrompt(clearGlass);

  it("travels alone: every value is spelled out, not referenced", () => {
    expect(prompt).toContain("#2f6bff");
    expect(prompt).toContain("16px");
    // No instruction the reader cannot follow without our tools.
    expect(prompt).not.toContain("verify");
    expect(prompt).not.toContain("MCP");
  });

  it("carries the rules as rules, not as prose", () => {
    for (const rule of clearGlass.rules) {
      expect(prompt).toContain(rule.statement);
    }
    expect(prompt).toContain("MUST:");
  });

  it("draws each component state as literal CSS", () => {
    expect(prompt).toContain("default → background: #2f6bff");
    expect(prompt).toContain("disabled → background: #e6e8eb");
  });

  it("names the system and closes with a checklist", () => {
    expect(prompt.startsWith(`Design everything you build in the style of ${clearGlass.meta.name}`))
      .toBe(true);
    expect(prompt).toContain("Before you call it done");
  });

  it("survives a system with nothing but a name", () => {
    const bare = parseDesignSystem({ meta: { name: "Bare" }, tokens: {} });
    const out = toStylePrompt(bare);
    expect(out).toContain("Bare");
    expect(out).not.toContain("\n\n\n");
  });
});
