import { describe, expect, it } from "vitest";
import { safePreview, safeStyles } from "../src/preview.js";
import { parseDesignSystem } from "../src/schema.js";
import { clearGlass } from "../src/fixtures/clearGlass.js";

describe("safeStyles", () => {
  it("keeps the properties a preview needs, camelCased for React", () => {
    expect(
      safeStyles({ "background-color": "#2f6bff", borderRadius: "8px", padding: "8px 16px" }),
    ).toEqual({ backgroundColor: "#2f6bff", borderRadius: "8px", padding: "8px 16px" });
  });

  it("drops properties that could move the sample off its card", () => {
    expect(safeStyles({ position: "fixed", zIndex: "9999", top: "0", transform: "scale(40)" }))
      .toEqual({});
  });

  it("refuses values that fetch, import, or close the declaration", () => {
    expect(
      safeStyles({
        background: "url(https://evil.example/pixel.png)",
        color: "red; position: fixed",
        border: "1px solid red } body {",
        fontFamily: '"a"; @import "x"',
      }),
    ).toEqual({});
  });

  it("clamps sizes that would escape the preview box", () => {
    expect(safeStyles({ width: "5000px", height: "100vh", minWidth: "120px" })).toEqual({
      minWidth: "120px",
    });
  });

  it("ignores empty and absurdly long values", () => {
    expect(safeStyles({ color: "   ", background: "#".padEnd(400, "a") })).toEqual({});
  });
});

describe("safePreview", () => {
  it("returns null when there is no preview to draw", () => {
    expect(safePreview(undefined)).toBeNull();
    expect(safePreview({ element: "button", states: [] })).toBeNull();
  });

  it("sanitises each state and keeps its name", () => {
    const safe = safePreview({
      element: "button",
      label: "Save",
      states: [
        { name: "default", styles: { background: "#2f6bff", position: "fixed" } },
        { name: "hover", styles: { background: "#2558d6" } },
      ],
    });
    expect(safe?.states.map((state) => state.name)).toEqual(["default", "hover"]);
    expect(safe?.states[0].styles).toEqual({ background: "#2f6bff" });
  });

  it("caps how many states one component can draw", () => {
    const states = Array.from({ length: 20 }, (_, i) => ({
      name: `s${i}`,
      styles: { color: "#000" },
    }));
    expect(safePreview({ element: "badge", states })?.states).toHaveLength(8);
  });
});

describe("the preview field on the schema", () => {
  it("is optional, so a system extracted before previews existed still parses", () => {
    const without = { ...clearGlass, components: [{ name: "Button" }] };
    expect(parseDesignSystem(without).components[0].preview).toBeUndefined();
  });

  it("defaults element to button and styles to an empty object", () => {
    const parsed = parseDesignSystem({
      ...clearGlass,
      components: [{ name: "Chip", preview: { states: [{ name: "default" }] } }],
    });
    expect(parsed.components[0].preview).toEqual({
      element: "button",
      states: [{ name: "default", styles: {} }],
    });
  });
});
