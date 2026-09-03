import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export interface Caller {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/**
 * Verify a Firebase ID token from an Authorization header.
 *
 * Returns null rather than throwing so callers decide the status code — an
 * expired token on a dashboard poll is not the same event as a forged one.
 */
export async function verifyCaller(
  authorization: string | undefined,
): Promise<Caller | null> {
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!match) return null;
  try {
    const decoded = await getAuth().verifyIdToken(match[1]!.trim());
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch (err) {
    // The caller only learns "sign in first", which is right — but an operator
    // staring at a login that will not work needs the actual reason.
    console.warn("token verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type Role = "owner" | "admin" | "member";

/** Membership is the authorisation boundary for everything team-scoped. */
export async function isMember(
  db: Firestore,
  teamId: string,
  uid: string,
): Promise<boolean> {
  return (await memberRole(db, teamId, uid)) !== null;
}

export async function memberRole(
  db: Firestore,
  teamId: string,
  uid: string,
): Promise<Role | null> {
  const doc = await db.collection("teams").doc(teamId).collection("members").doc(uid).get();
  if (!doc.exists) return null;
  const role = doc.get("role");
  return role === "owner" || role === "admin" ? role : "member";
}

/** Who may invite, remove, and pay: not every member. */
export function canManageTeam(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}
