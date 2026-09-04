import { countTokens, diffSystems, type DesignSystem, type SystemDiff, type VerifyResult } from "@miswadah/core";
import type {
  ProjectContext,
  Screen,
  ScreenMeta,
  Store,
  StoredSystem,
  VersionRef,
} from "../src/store.js";

/** An in-memory Store, so the tools can be tested without a database. */
export class MemoryStore implements Store {
  readonly verifications: VerifyResult[] = [];
  private versions: StoredSystem[] = [];
  private currentId: string | null = null;

  constructor(
    private readonly keys: Record<string, ProjectContext> = {
      "ms_live_test": {
        projectId: "p1",
        teamId: "t1",
        systemId: "s1",
        projectName: "acme-web",
        plan: "free",
      },
    },
  ) {}

  async resolveKey(key: string) {
    return this.keys[key] ?? null;
  }

  async getCurrent(): Promise<StoredSystem | null> {
    return this.versions.find((v) => v.versionId === this.currentId) ?? null;
  }

  async listVersions(_ctx: ProjectContext, limit: number): Promise<VersionRef[]> {
    return [...this.versions].reverse().slice(0, limit);
  }

  async getVersion(_ctx: ProjectContext, versionId: string) {
    return this.versions.find((v) => v.versionId === versionId) ?? null;
  }

  async pushVersion(_ctx: ProjectContext, system: DesignSystem, diff: SystemDiff) {
    const n = this.versions.length + 1;
    const stored: StoredSystem = {
      versionId: `v${n}`,
      n,
      createdAt: new Date(Date.UTC(2026, 0, n)).toISOString(),
      source: system.meta.source,
      summary: diff.summary,
      tokenCount: countTokens(system),
      system,
    };
    this.versions.push(stored);
    this.currentId = stored.versionId;
    return stored;
  }

  async restoreVersion(ctx: ProjectContext, versionId: string) {
    const target = this.versions.find((v) => v.versionId === versionId);
    if (!target) throw new Error("no such version");
    const current = await this.getCurrent();
    return this.pushVersion(ctx, target.system, diffSystems(current?.system ?? null, target.system));
  }

  async recordVerification(_ctx: ProjectContext, result: VerifyResult) {
    this.verifications.push(result);
  }

  async touchProject() {}

  readonly screens: Screen[] = [];

  /**
   * Metadata only, exactly like Firestore: a test that got the image bytes
   * back from a listing would pass while the real store returned nothing.
   */
  async listScreens(): Promise<ScreenMeta[]> {
    return this.screens.map(({ data: _data, ...meta }) => ({ ...meta }));
  }

  async getScreen(_ctx: ProjectContext, screenId: string) {
    return this.screens.find((screen) => screen.id === screenId) ?? null;
  }

  async putScreen(_ctx: ProjectContext, screen: Omit<Screen, "id" | "createdAt">) {
    const id = screen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const saved = { id, createdAt: "2026-01-01T00:00:00.000Z", ...screen };
    const at = this.screens.findIndex((existing) => existing.id === id);
    if (at === -1) this.screens.push(saved);
    else this.screens[at] = saved;
    const { data: _data, ...meta } = saved;
    return meta;
  }

  async deleteScreen(_ctx: ProjectContext, screenId: string) {
    const at = this.screens.findIndex((screen) => screen.id === screenId);
    if (at === -1) return false;
    this.screens.splice(at, 1);
    return true;
  }
}
