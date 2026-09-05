import {
  diffSystems,
  parseDesignSystem,
  renderForAgent,
  countTokens,
  toDesignMd,
  toStylePrompt,
  toW3CTokens,
  verify,
  type FileInput,
} from "@miswadah/core";
import {
  MAX_INLINE_SCREENS,
  MAX_SCREEN_BYTES,
  MAX_SCREENS,
  type ProjectContext,
  type ScreenKind,
  type ScreenMeta,
  type Store,
} from "./store.js";

/**
 * The three things an agent can do with a design system: read it, check its
 * own work against it, and push a new version when the brand moves.
 *
 * Every tool is a plain async function so it can be tested directly; the MCP
 * wiring in server.ts is a thin shell over these.
 */

const NO_SYSTEM =
  "No design system has been pushed for this project yet. Run the extraction " +
  "prompt in this repo, then call push_design_system with the result.";

export async function getDesignSystem(store: Store, ctx: ProjectContext): Promise<string> {
  const current = await store.getCurrent(ctx);
  await store.touchProject(ctx);
  if (!current) return NO_SYSTEM;
  const screens = await store.listScreens(ctx);
  return [
    `<!-- ${ctx.projectName} · v${current.n} · ${current.tokenCount} tokens -->`,
    renderForAgent(current.system),
    describeScreens(screens),
  ].join("\n");
}

/**
 * Screens, rendered as MCP image content.
 *
 * The point of storing them is that a vision-capable agent can look at the
 * product before it adds to it — a caption describing a screenshot would be
 * worth much less than the screenshot. Only the first few are attached: a
 * whole app's worth of images would crowd out the system they illustrate, and
 * the rest are one `get_screen` call away.
 */
export async function screenContent(
  store: Store,
  ctx: ProjectContext,
): Promise<{ type: "image"; data: string; mimeType: string }[]> {
  const screens = await store.listScreens(ctx);
  const out: { type: "image"; data: string; mimeType: string }[] = [];
  for (const meta of screens.slice(0, MAX_INLINE_SCREENS)) {
    const screen = await store.getScreen(ctx, meta.id);
    if (!screen?.data) continue;
    out.push({ type: "image", data: screen.data, mimeType: screen.mimeType });
  }
  return out;
}

/** One screen by name or id, for an agent that wants to look closer. */
export async function getScreen(
  store: Store,
  ctx: ProjectContext,
  nameOrId: string,
): Promise<
  | { text: string; image?: undefined }
  | { text: string; image: { data: string; mimeType: string } }
> {
  const wanted = nameOrId.trim().toLowerCase();
  const screens = await store.listScreens(ctx);
  if (screens.length === 0) {
    return { text: "This system has no screenshots yet." };
  }
  const match =
    screens.find((screen) => screen.id.toLowerCase() === wanted) ??
    screens.find((screen) => screen.name.toLowerCase() === wanted);
  if (!match) {
    return {
      text:
        `No screen called "${nameOrId}". This system has: ` +
        `${screens.map((screen) => screen.name).join(", ")}.`,
    };
  }
  const screen = await store.getScreen(ctx, match.id);
  if (!screen?.data) return { text: `"${match.name}" is stored but its image is missing.` };
  return {
    text: `${screen.name}${screen.description ? ` — ${screen.description}` : ""}`,
    image: { data: screen.data, mimeType: screen.mimeType },
  };
}

export function describeScreens(screens: ScreenMeta[]): string {
  if (screens.length === 0) return "";
  const lines = screens.map(
    (screen) =>
      `- ${screen.name}${screen.description ? ` — ${screen.description}` : ""}` +
      (screen.kind === "impression" ? " [mood reference, not a real screen]" : ""),
  );
  const overflow = screens.length - MAX_INLINE_SCREENS;
  return [
    "",
    "## What the product looks like",
    "The images attached to this response are screenshots of the real product.",
    "Match their density, weight, and mood — not only the token values.",
    ...lines,
    ...(overflow > 0
      ? [
          "",
          `Only the first ${MAX_INLINE_SCREENS} are attached. Call \`get_screen\` ` +
            `with a name above to see any of the other ${overflow}.`,
        ]
      : []),
  ].join("\n");
}

export async function addScreen(
  store: Store,
  ctx: ProjectContext,
  input: {
    name: string;
    description?: string;
    data: string;
    mimeType: string;
    kind?: ScreenKind;
  },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) return "A screen needs a name — what part of the product is this?";

  const mimeType = input.mimeType?.trim().toLowerCase();
  if (!/^image\/(png|jpeg|webp)$/.test(mimeType ?? "")) {
    return `Unsupported image type ${mimeType || "(none)"}. Use PNG, JPEG, or WebP.`;
  }

  // Strip a data: prefix if the caller sent one; both shapes are reasonable.
  const data = (input.data ?? "").replace(/^data:[^,]+,/, "").trim();
  if (!data) return "The image was empty.";

  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_SCREEN_BYTES) {
    return (
      `That image is ${Math.round(bytes / 1000)} KB; the limit is ` +
      `${MAX_SCREEN_BYTES / 1000} KB. Re-encode it as WebP, around 1200px wide.`
    );
  }

  const existing = await store.listScreens(ctx);
  if (existing.length >= MAX_SCREENS && !existing.some((screen) => screen.name === name)) {
    return (
      `This system already has ${MAX_SCREENS} screens, which is the limit. ` +
      `Replace one by using its exact name, or remove one first.`
    );
  }

  const kind: ScreenKind = input.kind === "impression" ? "impression" : "capture";
  const saved = await store.putScreen(ctx, {
    name,
    description: input.description?.trim() || undefined,
    kind,
    data,
    mimeType: mimeType!,
    bytes,
  });
  const held = (await store.listScreens(ctx)).length;
  return `Saved "${saved.name}" (${Math.round(bytes / 1000)} KB). ${held} of ${MAX_SCREENS} screens.`;
}

/**
 * What this key can see, without any image bytes.
 *
 * Deliberately reports the systemId back. When screens are "missing", the
 * first question is always whether they were written where they are being
 * looked for, and this is the only view that answers it without going through
 * Firestore's security rules — the server reads as itself.
 */
export async function listScreensFor(
  store: Store,
  ctx: ProjectContext,
): Promise<{
  systemId: string;
  systemName: string | null;
  projectId: string;
  total: number;
  limit: number;
  screens: ScreenMeta[];
}> {
  const [screens, current] = await Promise.all([store.listScreens(ctx), store.getCurrent(ctx)]);
  return {
    systemId: ctx.systemId,
    systemName: current?.system.meta.name ?? null,
    projectId: ctx.projectId,
    total: screens.length,
    limit: MAX_SCREENS,
    screens,
  };
}

/** Remove one screen by name or id, image bytes included. */
export async function removeScreen(
  store: Store,
  ctx: ProjectContext,
  nameOrId: string,
): Promise<{ deleted: string | null; total: number; error?: string }> {
  const wanted = nameOrId.trim().toLowerCase();
  const screens = await store.listScreens(ctx);
  if (!wanted) {
    return { deleted: null, total: screens.length, error: "Which screen? Send its name." };
  }
  const match =
    screens.find((screen) => screen.id.toLowerCase() === wanted) ??
    screens.find((screen) => screen.name.toLowerCase() === wanted);
  if (!match) {
    return {
      deleted: null,
      total: screens.length,
      error: `No screen called "${nameOrId}".`,
    };
  }
  await store.deleteScreen(ctx, match.id);
  return { deleted: match.name, total: (await store.listScreens(ctx)).length };
}

export async function verifyFiles(
  store: Store,
  ctx: ProjectContext,
  files: FileInput[],
): Promise<string> {
  const current = await store.getCurrent(ctx);
  if (!current) return NO_SYSTEM;

  const result = verify(current.system, files);
  await store.recordVerification(ctx, result);

  if (result.pass) {
    return `${result.receipt}\n\nNothing to fix — every visual value is on the system.`;
  }

  const lines = [result.receipt, ""];
  let lastPath = "";
  for (const v of result.violations) {
    if (v.path !== lastPath) {
      lines.push(`${v.path}`);
      lastPath = v.path;
    }
    lines.push(`  line ${v.line}: ${v.message}`);
  }
  lines.push(
    "",
    "Fix each value above using the token named, then call verify again on the",
    "same files. Do not finish until it passes.",
  );
  return lines.join("\n");
}

export async function pushDesignSystem(
  store: Store,
  ctx: ProjectContext,
  input: unknown,
): Promise<string> {
  const system = parseDesignSystem(input);
  const current = await store.getCurrent(ctx);
  const diff = diffSystems(current?.system ?? null, system);

  if (diff.identical && current) {
    return `No changes — the system is already at v${current.n} (${current.tokenCount} tokens). Nothing pushed.`;
  }

  const version = await store.pushVersion(ctx, system, diff);
  const lines = [
    `Pushed v${version.n} — ${countTokens(system)} tokens · ${diff.summary}`,
  ];
  if (diff.added.length) lines.push(`  added: ${diff.added.slice(0, 12).join(", ")}`);
  if (diff.removed.length) lines.push(`  removed: ${diff.removed.slice(0, 12).join(", ")}`);
  for (const change of diff.changed.slice(0, 12)) {
    lines.push(`  changed: ${change.path} ${change.from} → ${change.to}`);
  }
  lines.push("", "Every project on this team picks it up on its next session.");
  return lines.join("\n");
}

export async function listVersions(store: Store, ctx: ProjectContext): Promise<string> {
  const versions = await store.listVersions(ctx, 20);
  if (versions.length === 0) return NO_SYSTEM;
  // The id is printed because restore_version needs it — a list an agent
  // cannot act on is not a list.
  return versions
    .map(
      (v) =>
        `v${v.n} · ${v.createdAt} · ${v.tokenCount} tokens · ${v.summary} · id=${v.versionId}`,
    )
    .join("\n");
}

export async function restoreVersion(
  store: Store,
  ctx: ProjectContext,
  versionId: string,
): Promise<string> {
  const target = await store.getVersion(ctx, versionId);
  if (!target) return `No version ${versionId} on this system.`;
  const restored = await store.restoreVersion(ctx, versionId);
  return `Restored v${target.n} as v${restored.n}. History is intact — nothing was deleted.`;
}

export async function exportSystem(
  store: Store,
  ctx: ProjectContext,
  format: "design-md" | "tokens-json" | "style-prompt",
): Promise<string> {
  const current = await store.getCurrent(ctx);
  if (!current) return NO_SYSTEM;
  switch (format) {
    case "tokens-json":
      return JSON.stringify(toW3CTokens(current.system), null, 2);
    case "style-prompt":
      return toStylePrompt(current.system);
    default:
      return toDesignMd(current.system);
  }
}
