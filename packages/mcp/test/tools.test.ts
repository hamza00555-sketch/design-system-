import { clearGlass } from "@miswadah/core/fixtures/clearGlass";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addScreen,
  screenContent,
  exportSystem,
  getDesignSystem,
  listVersions,
  pushDesignSystem,
  restoreVersion,
  verifyFiles,
} from "../src/tools.js";
import { MemoryStore } from "./memoryStore.js";

const ctx = {
  projectId: "p1",
  teamId: "t1",
  systemId: "s1",
  projectName: "acme-web",
  plan: "free" as const,
};

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
});

describe("before anything is pushed", () => {
  it("tells the agent how to get a system", async () => {
    expect(await getDesignSystem(store, ctx)).toContain("No design system has been pushed");
    expect(await verifyFiles(store, ctx, [{ path: "a.css", content: "" }])).toContain(
      "No design system",
    );
  });
});

describe("push_design_system", () => {
  it("creates the first version", async () => {
    const out = await pushDesignSystem(store, ctx, clearGlass);
    expect(out).toContain("Pushed v1");
    expect(out).toContain("tokens");
  });

  it("refuses to create a version when nothing changed", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const out = await pushDesignSystem(store, ctx, clearGlass);
    expect(out).toContain("No changes");
    expect(await listVersions(store, ctx)).not.toContain("v2");
  });

  it("names what moved between versions", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const next = structuredClone(clearGlass);
    next.tokens.color.primary!.value = "#0055ff";
    const out = await pushDesignSystem(store, ctx, next);
    expect(out).toContain("Pushed v2");
    expect(out).toContain("color.primary #2f6bff → #0055ff");
  });

  it("rejects a system that does not match the schema", async () => {
    await expect(pushDesignSystem(store, ctx, { meta: {} })).rejects.toThrow();
  });
});

describe("get_design_system", () => {
  it("renders tokens and rules for generation", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const out = await getDesignSystem(store, ctx);
    expect(out).toContain("acme-web · v1");
    expect(out).toContain("primary=#2f6bff");
    expect(out).toContain("Every gap, padding, and margin must land on the spacing scale.");
  });
});

describe("verify", () => {
  beforeEach(async () => {
    await pushDesignSystem(store, ctx, clearGlass);
  });

  it("passes clean work and says so plainly", async () => {
    const out = await verifyFiles(store, ctx, [
      { path: "src/Card.tsx", content: `<div style={{ gap: "16px", color: "#0d1117" }} />` },
    ]);
    expect(out).toContain("verify → pass");
    expect(out).toContain("Nothing to fix");
  });

  it("reports each off-brand value with its file and line", async () => {
    const out = await verifyFiles(store, ctx, [
      { path: "src/Card.tsx", content: `.a {\n  color: #3D7BF2;\n  gap: 14px;\n}` },
    ]);
    expect(out).toContain("verify → fail");
    expect(out).toContain("src/Card.tsx");
    expect(out).toContain("line 2:");
    expect(out).toContain("use color.primary");
    expect(out).toContain("line 3:");
    expect(out).toContain("use spacing.md");
    expect(out).toContain("Do not finish until it passes.");
  });

  it("records every run for the dashboard", async () => {
    await verifyFiles(store, ctx, [{ path: "a.css", content: ".a { gap: 14px; }" }]);
    expect(store.verifications).toHaveLength(1);
    expect(store.verifications[0]?.pass).toBe(false);
  });
});

describe("history and export", () => {
  it("restores an earlier version without deleting anything", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const next = structuredClone(clearGlass);
    next.tokens.color.primary!.value = "#0055ff";
    await pushDesignSystem(store, ctx, next);

    const out = await restoreVersion(store, ctx, "v1");
    expect(out).toContain("Restored v1 as v3");
    expect(await getDesignSystem(store, ctx)).toContain("primary=#2f6bff");
    expect(await listVersions(store, ctx)).toContain("v3");
  });

  it("prints the id restore_version needs", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const listing = await listVersions(store, ctx);
    expect(listing).toContain("id=v1");
    expect(await restoreVersion(store, ctx, "v1")).toContain("Restored v1");
  });

  it("exports both formats", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    expect(await exportSystem(store, ctx, "design-md")).toContain("# Clear Glass");
    const json = JSON.parse(await exportSystem(store, ctx, "tokens-json"));
    expect(json.color.primary.$value).toBe("#2f6bff");
  });
});

describe("screens", () => {
  const png = Buffer.from("a".repeat(600)).toString("base64");

  beforeEach(async () => {
    await pushDesignSystem(store, ctx, clearGlass);
  });

  it("stores a screenshot and reports how many are held", async () => {
    const out = await addScreen(store, ctx, {
      name: "Dashboard",
      description: "The main view",
      data: png,
      mimeType: "image/png",
    });
    expect(out).toContain("Saved \"Dashboard\"");
    expect(out).toContain("1 of 8");
  });

  it("accepts a data: URL, because an agent sending one is being reasonable", async () => {
    await addScreen(store, ctx, {
      name: "Settings",
      data: `data:image/png;base64,${png}`,
      mimeType: "image/png",
    });
    expect(store.screens[0]?.data.startsWith("data:")).toBe(false);
  });

  it("replaces a screen of the same name instead of piling up", async () => {
    await addScreen(store, ctx, { name: "Dashboard", data: png, mimeType: "image/png" });
    await addScreen(store, ctx, { name: "Dashboard", data: png, mimeType: "image/webp" });
    expect(store.screens).toHaveLength(1);
    expect(store.screens[0]?.mimeType).toBe("image/webp");
  });

  it("refuses an image too large to store", async () => {
    const huge = "a".repeat(700_000);
    const out = await addScreen(store, ctx, { name: "Big", data: huge, mimeType: "image/png" });
    expect(out).toContain("the limit is");
    expect(store.screens).toHaveLength(0);
  });

  it("refuses a file that is not an image", async () => {
    const out = await addScreen(store, ctx, {
      name: "Notes",
      data: png,
      mimeType: "application/pdf",
    });
    expect(out).toContain("Unsupported image type");
  });

  it("needs a name, because an unnamed screenshot says nothing", async () => {
    expect(await addScreen(store, ctx, { name: "  ", data: png, mimeType: "image/png" })).toContain(
      "needs a name",
    );
  });

  it("hands the screenshots to the agent as images", async () => {
    await addScreen(store, ctx, { name: "Dashboard", data: png, mimeType: "image/png" });
    const images = await screenContent(store, ctx);
    expect(images).toEqual([{ type: "image", data: png, mimeType: "image/png" }]);
  });

  it("names them in the system text so the agent knows what it is looking at", async () => {
    await addScreen(store, ctx, {
      name: "Dashboard",
      description: "The main view",
      data: png,
      mimeType: "image/png",
    });
    const body = await getDesignSystem(store, ctx);
    expect(body).toContain("What the product looks like");
    expect(body).toContain("Dashboard — The main view");
  });
});
