import {
  diffSystems,
  parseDesignSystem,
  renderForAgent,
  countTokens,
  toDesignMd,
  toW3CTokens,
  verify,
  type FileInput,
} from "@tokenwell/core";
import type { ProjectContext, Store } from "./store.js";

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
  return [
    `<!-- ${ctx.projectName} · v${current.n} · ${current.tokenCount} tokens -->`,
    renderForAgent(current.system),
  ].join("\n");
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
  return versions
    .map((v) => `v${v.n} · ${v.createdAt} · ${v.tokenCount} tokens · ${v.summary}`)
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
  format: "design-md" | "tokens-json",
): Promise<string> {
  const current = await store.getCurrent(ctx);
  if (!current) return NO_SYSTEM;
  return format === "design-md"
    ? toDesignMd(current.system)
    : JSON.stringify(toW3CTokens(current.system), null, 2);
}
