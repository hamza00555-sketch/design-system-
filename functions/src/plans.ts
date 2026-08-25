import type { Firestore } from "firebase-admin/firestore";

export type Plan = "free" | "pro";

export interface PlanLimits {
  /** Repos that can be connected. */
  projects: number;
  /** People on the team, counting pending invitations. */
  seats: number;
}

/**
 * Where the free plan stops and paying starts.
 *
 * One system, one project, one person: enough to prove the thing on a real
 * repo. Paying starts where the pain does — the second project or the second
 * person, both of which mean it is already working.
 */
export const PLANS: Record<Plan, PlanLimits> = {
  free: { projects: 1, seats: 1 },
  pro: { projects: Number.POSITIVE_INFINITY, seats: Number.POSITIVE_INFINITY },
};

export function planOf(value: unknown): Plan {
  return value === "pro" ? "pro" : "free";
}

export async function planForTeam(db: Firestore, teamId: string): Promise<Plan> {
  const team = await db.collection("teams").doc(teamId).get();
  return planOf(team.get("plan"));
}

export async function countProjects(db: Firestore, teamId: string): Promise<number> {
  const snap = await db.collection("projects").where("teamId", "==", teamId).get();
  return snap.size;
}

/** Members plus outstanding invitations — an invite holds a seat. */
export async function countSeats(db: Firestore, teamId: string): Promise<number> {
  const [members, invites] = await Promise.all([
    db.collection("teams").doc(teamId).collection("members").get(),
    db
      .collection("invites")
      .where("teamId", "==", teamId)
      .where("status", "==", "pending")
      .get(),
  ]);
  return members.size + invites.size;
}

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkProjectLimit(
  db: Firestore,
  teamId: string,
  plan: Plan,
): Promise<LimitCheck> {
  const limit = PLANS[plan].projects;
  if (limit === Number.POSITIVE_INFINITY) return { allowed: true, used: 0, limit };
  const used = await countProjects(db, teamId);
  return { allowed: used < limit, used, limit };
}

export async function checkSeatLimit(
  db: Firestore,
  teamId: string,
  plan: Plan,
): Promise<LimitCheck> {
  const limit = PLANS[plan].seats;
  if (limit === Number.POSITIVE_INFINITY) return { allowed: true, used: 0, limit };
  const used = await countSeats(db, teamId);
  return { allowed: used < limit, used, limit };
}
