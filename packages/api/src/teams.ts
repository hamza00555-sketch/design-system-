import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Caller } from "./auth.js";

export type Failure = { ok: false; status: number; error: string; code: string };
export type Success<T> = { ok: true } & T;
export type Outcome<T = Record<string, unknown>> = Success<T> | Failure;

function fail(status: number, error: string, code: string): Failure {
  return { ok: false, status, error, code };
}

export interface Workspace {
  teamId: string;
  systemId: string;
  plan: "free" | "pro";
  teamName: string;
  role: "owner" | "admin" | "member";
}

/**
 * Find or create this person's workspace.
 *
 * Called on every sign-in and safe to repeat: an existing membership short-
 * circuits, so the only path that writes is a genuinely new account. Deriving
 * the ids from the uid makes that idempotent even under a double-click.
 */
export async function bootstrapWorkspace(db: Firestore, caller: Caller): Promise<Workspace> {
  const existing = await db
    .collectionGroup("members")
    .where("uid", "==", caller.uid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const memberDoc = existing.docs[0]!;
    const teamId = memberDoc.ref.parent.parent!.id;
    const team = await db.collection("teams").doc(teamId).get();
    const systemId = (team.get("defaultSystemId") as string | undefined) ?? `sys_${teamId}`;
    return {
      teamId,
      systemId,
      plan: team.get("plan") === "pro" ? "pro" : "free",
      teamName: (team.get("name") as string) ?? "My team",
      role: (memberDoc.get("role") as Workspace["role"]) ?? "member",
    };
  }

  const teamId = `team_${caller.uid}`;
  const systemId = `sys_${teamId}`;
  const teamName = caller.name ? `${caller.name.split(" ")[0]}'s team` : "My team";

  const batch = db.batch();
  batch.set(
    db.collection("teams").doc(teamId),
    {
      name: teamName,
      plan: "free",
      ownerUid: caller.uid,
      defaultSystemId: systemId,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    db.collection("teams").doc(teamId).collection("members").doc(caller.uid),
    {
      uid: caller.uid,
      email: caller.email,
      name: caller.name,
      picture: caller.picture,
      role: "owner",
      joinedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    db.collection("systems").doc(systemId),
    {
      teamId,
      name: teamName,
      versionCount: 0,
      currentVersionId: null,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return { teamId, systemId, plan: "free", teamName, role: "owner" };
}

/**
 * A second design system for the same team.
 *
 * One team was always meant to hold several: a design system belongs to a
 * product, and people have more than one product. The plumbing already carried
 * a systemId everywhere — projects, versions, screens, verifications are all
 * keyed by it — so this only had to stop being a single value derived from the
 * team id.
 */
export async function createSystem(
  db: Firestore,
  input: { teamId: string; name: string; createdBy: string },
): Promise<{ systemId: string; name: string }> {
  const name = input.name.trim() || "Untitled system";
  const ref = db.collection("systems").doc();
  await ref.set({
    teamId: input.teamId,
    name,
    versionCount: 0,
    currentVersionId: null,
    createdBy: input.createdBy,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { systemId: ref.id, name };
}

/**
 * Take somebody off a team.
 *
 * Invitations are gone, so no new member can be added this way — but teams
 * that gained members while invitations existed still need a way to shed one.
 */
export async function removeMember(
  db: Firestore,
  teamId: string,
  uid: string,
): Promise<Outcome> {
  const teamRef = db.collection("teams").doc(teamId);
  const team = await teamRef.get();
  if (team.get("ownerUid") === uid) {
    return fail(403, "The team owner cannot be removed.", "forbidden");
  }
  const memberRef = teamRef.collection("members").doc(uid);
  if (!(await memberRef.get()).exists) {
    return fail(404, "They are not on this team.", "not_found");
  }
  await memberRef.delete();
  return { ok: true };
}
