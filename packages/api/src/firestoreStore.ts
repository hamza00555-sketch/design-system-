import { countTokens, parseDesignSystem, type DesignSystem, type SystemDiff, type VerifyResult } from "@miswadah/core";
import type {
  ProjectContext,
  Screen,
  ScreenMeta,
  Store,
  StoredSystem,
  VersionRef,
} from "@miswadah/mcp";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { hashKey } from "./keys.js";

/**
 * Firestore layout
 *
 *   teams/{teamId}                        name, plan, ownerUid
 *   teams/{teamId}/members/{uid}          role, email
 *   systems/{systemId}                    teamId, name, currentVersionId, versionCount
 *   systems/{systemId}/versions/{id}      n, system, source, summary, createdAt  (immutable)
 *   projects/{projectId}                  teamId, systemId, name, repoName, keyPrefix
 *   projectKeys/{sha256(key)}             projectId                              (O(1) auth)
 *   connectCodes/{code}                   teamId, systemId, expiresAt, usedAt
 *   systems/{systemId}/screens/{id}       name, description, mimeType, bytes
 *   systems/{systemId}/screens/{id}/payload/image   data (base64)
 *   verifications/{id}                    projectId, passed, violationCount
 */
export class FirestoreStore implements Store {
  constructor(private readonly db: Firestore) {}

  async resolveKey(key: string): Promise<ProjectContext | null> {
    const keyDoc = await this.db.collection("projectKeys").doc(hashKey(key)).get();
    if (!keyDoc.exists) return null;
    const projectId = keyDoc.get("projectId") as string;

    const project = await this.db.collection("projects").doc(projectId).get();
    if (!project.exists) return null;
    const teamId = project.get("teamId") as string;

    const team = await this.db.collection("teams").doc(teamId).get();
    return {
      projectId,
      teamId,
      systemId: project.get("systemId") as string,
      projectName: (project.get("name") as string) ?? projectId,
      plan: ((team.get("plan") as string) === "pro" ? "pro" : "free"),
    };
  }

  private versions(systemId: string) {
    return this.db.collection("systems").doc(systemId).collection("versions");
  }

  async getCurrent(ctx: ProjectContext): Promise<StoredSystem | null> {
    const system = await this.db.collection("systems").doc(ctx.systemId).get();
    const currentVersionId = system.get("currentVersionId") as string | undefined;
    if (!currentVersionId) return null;
    return this.getVersion(ctx, currentVersionId);
  }

  async getVersion(ctx: ProjectContext, versionId: string): Promise<StoredSystem | null> {
    const doc = await this.versions(ctx.systemId).doc(versionId).get();
    if (!doc.exists) return null;
    return toStored(doc.id, doc.data()!);
  }

  async listVersions(ctx: ProjectContext, limit: number): Promise<VersionRef[]> {
    const snap = await this.versions(ctx.systemId).orderBy("n", "desc").limit(limit).get();
    return snap.docs.map((doc) => {
      const { system, ...ref } = toStored(doc.id, doc.data());
      return ref;
    });
  }

  async pushVersion(
    ctx: ProjectContext,
    system: DesignSystem,
    diff: SystemDiff,
  ): Promise<VersionRef> {
    const systemRef = this.db.collection("systems").doc(ctx.systemId);
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(systemRef);
      const n = ((current.get("versionCount") as number | undefined) ?? 0) + 1;
      const versionRef = systemRef.collection("versions").doc();
      const payload = {
        n,
        system,
        source: system.meta.source,
        summary: diff.summary,
        tokenCount: countTokens(system),
        createdAt: new Date().toISOString(),
        createdByProject: ctx.projectId,
      };
      tx.set(versionRef, payload);
      tx.set(
        systemRef,
        {
          teamId: ctx.teamId,
          name: system.meta.name,
          currentVersionId: versionRef.id,
          versionCount: n,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { versionId: versionRef.id, ...payload, system: undefined } as unknown as VersionRef;
    });
  }

  async restoreVersion(ctx: ProjectContext, versionId: string): Promise<VersionRef> {
    const target = await this.getVersion(ctx, versionId);
    if (!target) throw new Error(`No version ${versionId}`);
    return this.pushVersion(ctx, target.system, {
      added: [],
      removed: [],
      changed: [],
      identical: false,
      summary: `restored v${target.n}`,
    });
  }

  async recordVerification(ctx: ProjectContext, result: VerifyResult): Promise<void> {
    await this.db.collection("verifications").add({
      projectId: ctx.projectId,
      teamId: ctx.teamId,
      systemId: ctx.systemId,
      passed: result.pass,
      violationCount: result.violations.length,
      summary: result.summary,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  private screensRef(systemId: string) {
    return this.db.collection("systems").doc(systemId).collection("screens");
  }

  /**
   * The index document carries only what a listing needs. The image itself
   * lives one level down, so loading forty screen names costs forty small
   * reads instead of ten megabytes of base64.
   */
  private payloadRef(systemId: string, screenId: string) {
    return this.screensRef(systemId).doc(screenId).collection("payload").doc("image");
  }

  async listScreens(ctx: ProjectContext): Promise<ScreenMeta[]> {
    const snap = await this.screensRef(ctx.systemId).orderBy("name").get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      name: (doc.get("name") as string) ?? doc.id,
      description: (doc.get("description") as string) ?? undefined,
      kind: doc.get("kind") === "impression" ? "impression" : "capture",
      mimeType: (doc.get("mimeType") as string) ?? "image/png",
      bytes: (doc.get("bytes") as number) ?? 0,
      createdAt: (doc.get("createdAt") as string) ?? "",
    }));
  }

  async getScreen(ctx: ProjectContext, screenId: string): Promise<Screen | null> {
    const [meta, payload] = await Promise.all([
      this.screensRef(ctx.systemId).doc(screenId).get(),
      this.payloadRef(ctx.systemId, screenId).get(),
    ]);
    if (!meta.exists) return null;
    return {
      id: meta.id,
      name: (meta.get("name") as string) ?? meta.id,
      description: (meta.get("description") as string) ?? undefined,
      kind: meta.get("kind") === "impression" ? "impression" : "capture",
      mimeType: (meta.get("mimeType") as string) ?? "image/png",
      bytes: (meta.get("bytes") as number) ?? 0,
      createdAt: (meta.get("createdAt") as string) ?? "",
      data: (payload.get("data") as string) ?? "",
    };
  }

  async putScreen(
    ctx: ProjectContext,
    screen: Omit<Screen, "id" | "createdAt">,
  ): Promise<ScreenMeta> {
    // Keyed by name, so re-running a capture replaces the shot rather than
    // piling up near-identical ones until the limit is hit.
    const id = screen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      || "screen";
    const createdAt = new Date().toISOString();
    const { data, ...meta } = screen;
    const batch = this.db.batch();
    batch.set(this.screensRef(ctx.systemId).doc(id), { ...meta, createdAt });
    batch.set(this.payloadRef(ctx.systemId, id), { data });
    await batch.commit();
    return { id, createdAt, ...meta };
  }

  async deleteScreen(ctx: ProjectContext, screenId: string): Promise<boolean> {
    const ref = this.screensRef(ctx.systemId).doc(screenId);
    if (!(await ref.get()).exists) return false;
    // The payload is a subcollection, so deleting the index doc alone would
    // orphan the image bytes.
    await this.payloadRef(ctx.systemId, screenId).delete();
    await ref.delete();
    return true;
  }

  async touchProject(ctx: ProjectContext): Promise<void> {
    await this.db
      .collection("projects")
      .doc(ctx.projectId)
      .set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

function toStored(versionId: string, data: FirebaseFirestore.DocumentData): StoredSystem {
  const system = parseDesignSystem(data.system);
  return {
    versionId,
    n: data.n as number,
    createdAt: (data.createdAt as string) ?? "",
    source: system.meta.source,
    summary: (data.summary as string) ?? "",
    tokenCount: (data.tokenCount as number) ?? countTokens(system),
    system,
  };
}
