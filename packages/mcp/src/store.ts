import type { DesignSystem, SystemDiff, VerifyResult } from "@tokenwell/core";

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
}
