import { describe, expect, it } from "vitest";
import { clearGlass } from "../src/fixtures/clearGlass.js";
import { toDesignMd, toW3CTokens } from "../src/export.js";
import { countTokens, parseDesignSystem } from "../src/schema.js";
import { diffSystems } from "../src/diff.js";

describe("export", () => {
  it("produces W3C design tokens with $type and $value", () => {
    const tokens = toW3CTokens(clearGlass) as any;
    expect(tokens.color.primary).toEqual({
      $type: "color",
      $value: "#2f6bff",
      $description: "Primary actions, links, focus rings",
    });
    expect(tokens.spacing.md.$type).toBe("dimension");
    expect(tokens.typography.size.base.$value).toBe("16px");
  });

  it("produces a DESIGN.md carrying every token and rule", () => {
    const md = toDesignMd(clearGlass);
    expect(md).toContain("# Clear Glass — design system");
    expect(md).toContain("`primary`");
    expect(md).toContain("One primary action per view.");
    expect(md).toContain(`${countTokens(clearGlass)} tokens`);
  });
});

describe("schema", () => {
  it("round-trips the fixture", () => {
    expect(parseDesignSystem(JSON.parse(JSON.stringify(clearGlass)))).toEqual(clearGlass);
  });

  it("rejects a system with no name", () => {
    expect(() => parseDesignSystem({ meta: { name: "" }, tokens: {} })).toThrow();
  });

  it("fills in empty token groups", () => {
    const system = parseDesignSystem({ meta: { name: "Bare" }, tokens: {} });
    expect(system.tokens.color).toEqual({});
    expect(countTokens(system)).toBe(0);
  });
});

describe("diff", () => {
  it("reports a first push as all-added", () => {
    const diff = diffSystems(null, clearGlass);
    expect(diff.identical).toBe(false);
    expect(diff.removed).toHaveLength(0);
    expect(diff.added.length).toBeGreaterThan(0);
  });

  it("reports an unchanged push as identical", () => {
    expect(diffSystems(clearGlass, clearGlass).identical).toBe(true);
  });

  it("names a changed token", () => {
    const next = structuredClone(clearGlass);
    next.tokens.color.primary!.value = "#0055ff";
    const diff = diffSystems(clearGlass, next);
    expect(diff.changed).toEqual([
      { path: "color.primary", from: "#2f6bff", to: "#0055ff" },
    ]);
    expect(diff.summary).toBe("~1");
  });
});
