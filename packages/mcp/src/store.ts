import type { DesignSystem, SystemDiff, VerifyResult } from "@miswadah/core";

/** Who is calling — resolved from the project API key on every request. */
export interface ProjectContext {
  projectId: string;
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
export interface Screen {
  id: string;
  /** What this screen is: "dashboard", "workout in progress". */
  name: string;
  description?: string;
  /** Base64, no data: prefix. */
  data: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

/** Images are capped so one screenshot cannot fill a database document. */
export const MAX_SCREEN_BYTES = 400_000;
export const MAX_SCREENS = 8;

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
  listScreens(ctx: ProjectContext): Promise<Screen[]>;
  putScreen(ctx: ProjectContext, screen: Omit<Screen, "id" | "createdAt">): Promise<Screen>;
  deleteScreen(ctx: ProjectContext, screenId: string): Promise<boolean>;
}
