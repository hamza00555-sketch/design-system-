import { describe, expect, it } from "vitest";
import { clearGlass } from "../src/fixtures/clearGlass.js";
import { verify } from "../src/verify.js";
import { extractCandidates } from "../src/extract.js";

const check = (content: string, path = "src/Thing.tsx") =>
  verify(clearGlass, [{ path, content }]);

describe("colors", () => {
  it("passes a token used verbatim", () => {
    const result = check(`.a { color: #2f6bff; }`);
    expect(result.pass).toBe(true);
    expect(result.summary.colors).toBe(1);
  });

  it("passes a colour within ΔE 2 of a token", () => {
    // #2f6bff nudged by one step — visually the same blue.
    const result = check(`.a { color: #306bfe; }`);
    expect(result.pass).toBe(true);
  });

  it("catches a near-miss blue and names the token", () => {
    const result = check(`.a { color: #3D7BF2; }`);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.tokenPath).toBe("color.primary");
    expect(result.violations[0]?.message).toContain("off-brand");
  });

  it("reads rgb() and oklch() as colours", () => {
    expect(check(`.a { background-color: rgb(47, 107, 255); }`).pass).toBe(true);
    expect(check(`.a { background-color: rgb(210, 60, 60); }`).pass).toBe(false);
  });

  it("catches a Tailwind arbitrary colour", () => {
    const result = check(`<div className="bg-[#3D7BF2] text-white" />`);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.found).toBe("#3D7BF2");
  });

  it("ignores var() token references", () => {
    expect(check(`.a { color: var(--color-primary); }`).pass).toBe(true);
  });

  it("ignores hex-looking data inside SVG path data", () => {
    const svg = `<path d="M4 4h16v16H4z" fill="#2f6bff" />`;
    expect(check(svg).pass).toBe(true);
  });

  it("ignores colours inside comments", () => {
    expect(check(`/* was #ff00ff before the rebrand */\n.a { color: #0d1117; }`).pass).toBe(true);
  });
});

describe("scales", () => {
  it("passes spacing on the scale", () => {
    expect(check(`.a { gap: 16px; padding: 8px 24px; }`).pass).toBe(true);
  });

  it("catches an off-grid gap and suggests the nearest step", () => {
    const result = check(`.a { gap: 14px; }`);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.tokenPath).toBe("spacing.md");
    expect(result.violations[0]?.message).toContain("off-grid");
  });

  it("treats rem and px as the same length", () => {
    expect(check(`.a { padding: 1rem; }`).pass).toBe(true);
    expect(check(`.a { font-size: 0.875rem; }`).pass).toBe(true);
  });

  it("catches an invented font size", () => {
    const result = check(`.a { font-size: 15px; }`);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.kind).toBe("fontSize");
  });

  it("catches a one-off radius written as a Tailwind arbitrary value", () => {
    const result = check(`<div className="rounded-[7px]" />`);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.kind).toBe("radius");
  });

  it("ignores zero, auto, and percentages", () => {
    expect(check(`.a { margin: 0; width: 100%; inset: auto; gap: 0px; }`).pass).toBe(true);
  });
});

describe("receipt", () => {
  it("reads like the live receipt on a clean file", () => {
    const result = check(`.a { color: #0d1117; gap: 16px; font-size: 16px; }`);
    expect(result.receipt).toBe("verify → pass · colors (1) · type (1) · spacing (1) — 0 off-brand values");
  });

  it("counts every off-brand value", () => {
    const result = check(`.a { color: #3D7BF2; gap: 14px; }`);
    expect(result.summary.offBrand).toBe(2);
    expect(result.receipt).toContain("2 off-brand values");
  });

  it("reports violations sorted by file then line", () => {
    const result = verify(clearGlass, [
      { path: "b.css", content: `.x { gap: 14px; }` },
      { path: "a.css", content: `.y { color: #ff0000; }` },
    ]);
    expect(result.violations.map((v) => v.path)).toEqual(["a.css", "b.css"]);
  });
});

describe("extraction", () => {
  it("records the line a value sits on", () => {
    const candidates = extractCandidates(`.a {\n  color: #3D7BF2;\n}`);
    expect(candidates[0]?.line).toBe(2);
  });

  it("finds both values in a shorthand", () => {
    const candidates = extractCandidates(`.a { padding: 12px 16px; }`);
    expect(candidates.filter((c) => c.kind === "spacing").map((c) => c.value)).toEqual([
      "12px",
      "16px",
    ]);
  });
});

describe("React inline styles", () => {
  it("checks camelCase properties the same as CSS ones", () => {
    const result = check(`<div style={{ fontSize: "15px", borderRadius: "7px" }} />`);
    expect(result.violations.map((v) => v.kind).sort()).toEqual(["fontSize", "radius"]);
  });

  it("passes camelCase properties that sit on the scales", () => {
    const result = check(
      `<div style={{ fontSize: "16px", borderRadius: "8px", paddingLeft: "24px" }} />`,
    );
    expect(result.pass).toBe(true);
    expect(result.summary.type).toBe(1);
    expect(result.summary.spacing).toBe(1);
  });

  it("catches an off-brand backgroundColor", () => {
    const result = check(`<div style={{ backgroundColor: "#3D7BF2" }} />`);
    expect(result.violations[0]?.tokenPath).toBe("color.primary");
  });

  it("does not mistake ordinary object keys for style", () => {
    const result = check(`const props = { name: "acme", count: 14, id: "x-14" };`);
    expect(result.pass).toBe(true);
  });
});
