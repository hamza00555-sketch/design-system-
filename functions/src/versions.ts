import { diffSystems } from "@miswadah/core";
import type { Firestore } from "firebase-admin/firestore";
import { FirestoreStore } from "./firestoreStore.js";

/**
 * Restore a version from the dashboard.
 *
 * Restoring appends rather than rewrites: v3 becomes v5 with v3's contents, so
 * the history stays a record of what actually happened.
 */
export async function restoreVersionForTeam(
  db: Firestore,
  teamId: string,
  systemId: string,
  versionId: string,
): Promise<{ versionId: string; n: number }> {
  const store = new FirestoreStore(db);
  const ctx = {
    projectId: "dashboard",
    teamId,
    systemId,
    projectName: "dashboard",
    plan: "free" as const,
  };

  const target = await store.getVersion(ctx, versionId);
  if (!target) throw new Error("No such version.");

  const current = await store.getCurrent(ctx);
  const restored = await store.pushVersion(
    ctx,
    target.system,
    diffSystems(current?.system ?? null, target.system),
  );
  return { versionId: restored.versionId, n: restored.n };
}
