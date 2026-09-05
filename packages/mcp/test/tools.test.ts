import { clearGlass } from "@miswadah/core/fixtures/clearGlass";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addScreen,
  screenContent,
  exportSystem,
  getDesignSystem,
  getScreen,
  listScreensFor,
  listVersions,
  removeScreen,
  pushDesignSystem,
  restoreVersion,
  verifyFiles,
} from "../src/tools.js";
import { MemoryStore } from "./memoryStore.js";
import { MAX_INLINE_SCREENS, MAX_SCREENS } from "../src/store.js";

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

describe("generated pictures are never filed as real ones", () => {
  beforeEach(async () => {
    await pushDesignSystem(store, ctx, clearGlass);
  });

  it("records an impression as an impression", async () => {
    await addScreen(store, ctx, {
      name: "dashboard",
      kind: "impression",
      data: Buffer.from("mock").toString("base64"),
      mimeType: "image/webp",
    });
    expect((await store.listScreens(ctx))[0]!.kind).toBe("impression");
  });

  it("defaults to a capture, and treats an unknown kind as one", async () => {
    await addScreen(store, ctx, {
      name: "settings",
      data: Buffer.from("shot").toString("base64"),
      mimeType: "image/webp",
    });
    await addScreen(store, ctx, {
      name: "sign-in",
      kind: "nonsense" as never,
      data: Buffer.from("shot").toString("base64"),
      mimeType: "image/webp",
    });
    const kinds = (await store.listScreens(ctx)).map((s) => s.kind);
    expect(kinds).toEqual(["capture", "capture"]);
  });

  it("warns the agent which pictures are not evidence", async () => {
    await addScreen(store, ctx, {
      name: "dashboard",
      kind: "impression",
      data: Buffer.from("mock").toString("base64"),
      mimeType: "image/webp",
    });
    expect(await getDesignSystem(store, ctx)).toContain("not a real screen");
  });
});

describe("listing and deleting screens", () => {
  beforeEach(async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    for (const name of ["Dashboard", "Settings"]) {
      await addScreen(store, ctx, {
        name,
        data: Buffer.from(name).toString("base64"),
        mimeType: "image/webp",
      });
    }
  });

  it("names the system the key wrote to, and carries no image bytes", async () => {
    const listing = await listScreensFor(store, ctx);
    expect(listing.systemId).toBe(ctx.systemId);
    expect(listing.total).toBe(2);
    expect(listing.limit).toBe(MAX_SCREENS);
    // The whole point of the listing is that it is cheap.
    for (const screen of listing.screens) {
      expect(screen).not.toHaveProperty("data");
    }
  });

  it("deletes by name and reports the new total", async () => {
    const result = await removeScreen(store, ctx, "Dashboard");
    expect(result.deleted).toBe("Dashboard");
    expect(result.total).toBe(1);
    expect(await store.getScreen(ctx, "dashboard")).toBeNull();
  });

  it("refuses a name it does not hold rather than deleting something else", async () => {
    const result = await removeScreen(store, ctx, "checkout");
    expect(result.deleted).toBeNull();
    expect(result.error).toContain("checkout");
    expect((await store.listScreens(ctx)).length).toBe(2);
  });

  it("refuses an empty name", async () => {
    expect((await removeScreen(store, ctx, "   ")).error).toBeTruthy();
    expect((await store.listScreens(ctx)).length).toBe(2);
  });
});

describe("get_screen", () => {
  beforeEach(async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    for (const name of ["Dashboard", "Settings", "Sign in"]) {
      await addScreen(store, ctx, {
        name,
        data: Buffer.from(`pixels for ${name}`).toString("base64"),
        mimeType: "image/webp",
      });
    }
  });

  it("returns the named screen's image", async () => {
    const result = await getScreen(store, ctx, "Settings");
    expect(result.text).toContain("Settings");
    expect(result.image?.mimeType).toBe("image/webp");
  });

  it("matches on the stored id as well as the name", async () => {
    expect((await getScreen(store, ctx, "sign-in")).image).toBeDefined();
  });

  it("lists what it does have when the name is wrong", async () => {
    const result = await getScreen(store, ctx, "checkout");
    expect(result.image).toBeUndefined();
    expect(result.text).toContain("Dashboard");
    expect(result.text).toContain("Settings");
  });
});

describe("how many screens reach the agent at once", () => {
  it("attaches only the first few and points at the rest by name", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const names = Array.from({ length: MAX_INLINE_SCREENS + 3 }, (_, i) => `page-${i}`);
    for (const name of names) {
      await addScreen(store, ctx, {
        name,
        data: Buffer.from(name).toString("base64"),
        mimeType: "image/webp",
      });
    }

    expect(await screenContent(store, ctx)).toHaveLength(MAX_INLINE_SCREENS);
    const described = await getDesignSystem(store, ctx);
    // Every screen is still named, so the agent knows what it can ask for.
    for (const name of names) expect(described).toContain(name);
    expect(described).toContain("get_screen");
  });
});

describe("export", () => {
  it("hands back a style prompt that stands on its own", async () => {
    await pushDesignSystem(store, ctx, clearGlass);
    const out = await exportSystem(store, ctx, "style-prompt");
    expect(out).toContain("Design everything you build in the style of");
    expect(out).toContain("#2f6bff");
    expect(out).toContain("Before you call it done");
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
    expect(out).toContain(`1 of ${MAX_SCREENS}`);
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
