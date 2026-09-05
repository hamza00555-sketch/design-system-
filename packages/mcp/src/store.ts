import type { DesignSystem, SystemDiff, VerifyResult } from "@miswadah/core";

/** Who is calling — resolved from the project API key on every request. */
export interface ProjectContext {
  projectId: string;
  /**
   * What this key may do.
   *
   * A read key is safe to commit: it can look at the system and its pictures
   * and nothing else. That is what makes it possible to put one in an exported
   * DESIGN.md, where a write key would hand anyone who opens the repository
   * the ability to overwrite the design system.
   */
  scope: "read" | "write";
  teamId: string;
  systemId: string;
  projectName: string;
  plan: "free" | "pro";
}

export interface VersionRef {
  versionId: string;
  /** Human version number: v1, v2, v3… */
  n: number;
  createdAt: string;
  source: DesignSystem["meta"]["source"];
  summary: string;
  tokenCount: number;
}

export interface StoredSystem extends VersionRef {
  system: DesignSystem;
}

/**
 * A screenshot of the real product.
 *
 * Tokens carry the values; they do not carry the look. A hex code cannot tell
 * an agent that the app is dense and quiet rather than airy and loud, and MCP
 * can return images — so a screenshot is worth more here than another list.
 */
/**
 * Where a picture came from.
 *
 * `capture` is the running product. `impression` is an image made to convey
 * the same mood when the product could not be run — useful as a style
 * reference, and worthless if it is mistaken for evidence of what the app
 * actually looks like. Storing which is which is what keeps that honest.
 */
export type ScreenKind = "capture" | "impression";

export interface ScreenMeta {
  id: string;
  /** What this screen is: "dashboard", "settings-members". */
  name: string;
  description?: string;
  kind: ScreenKind;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

/** A screen with its pixels attached. Base64, no data: prefix. */
export interface Screen extends ScreenMeta {
  data: string;
}

export const MAX_SCREEN_BYTES = 250_000;
export const MAX_SCREENS = 40;

/**
 * How many screens `get_design_system` attaches as images. Forty screenshots
 * would bury the design system itself in the agent's context, so the rest are
 * listed by name and fetched with `get_screen` when the agent wants one.
 */
export const MAX_INLINE_SCREENS = 6;

/**
 * Everything the tools need from storage. Kept as an interface so the tools
 * can be tested without Firestore, and so the backend can be swapped.
 */
export interface Store {
  /** Resolve a bearer key to its project, or null when the key is unknown. */
  resolveKey(key: string): Promise<ProjectContext | null>;
  getCurrent(ctx: ProjectContext): Promise<StoredSystem | null>;
  listVersions(ctx: ProjectContext, limit: number): Promise<VersionRef[]>;
  getVersion(ctx: ProjectContext, versionId: string): Promise<StoredSystem | null>;
  /** Append an immutable version and move the pointer. */
  pushVersion(
    ctx: ProjectContext,
    system: DesignSystem,
    diff: SystemDiff,
  ): Promise<VersionRef>;
  restoreVersion(ctx: ProjectContext, versionId: string): Promise<VersionRef>;
  recordVerification(ctx: ProjectContext, result: VerifyResult): Promise<void>;
  touchProject(ctx: ProjectContext): Promise<void>;
  /**
   * Screens without their pixels. Metadata and image bytes are stored apart so
   * that listing a whole app's worth of screens costs kilobytes, not megabytes
   * — every caller here wants the names far more often than the images.
   */
  listScreens(ctx: ProjectContext): Promise<ScreenMeta[]>;
  /** One screen with its image, fetched only when something will display it. */
  getScreen(ctx: ProjectContext, screenId: string): Promise<Screen | null>;
  putScreen(ctx: ProjectContext, screen: Omit<Screen, "id" | "createdAt">): Promise<ScreenMeta>;
  deleteScreen(ctx: ProjectContext, screenId: string): Promise<boolean>;
}
