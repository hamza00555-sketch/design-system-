import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Caller } from "./auth.js";
import { checkSeatLimit, planForTeam } from "./plans.js";

/** Invitations expire so a forwarded email cannot let someone in next year. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteRole = "member" | "admin";

export type InviteResult = {
  inviteId: string;
  token: string;
  email: string;
  role: InviteRole;
  expiresAt: number;
};

export type Failure = { ok: false; status: number; error: string; code: string };
export type Success<T> = { ok: true } & T;
export type Outcome<T = Record<string, unknown>> = Success<T> | Failure;

function fail(status: number, error: string, code: string): Failure {
  return { ok: false, status, error, code };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * Invite someone to the team.
 *
 * The token is the capability — it is what the invitee clicks — so it is
 * random, single-use, and expiring. The email is recorded but not trusted as
 * the check: people sign in with whichever address their Google or GitHub
 * account carries, and refusing them at the door because it differs by a dot
 * would be a support ticket, not security.
 */
export async function inviteMember(
  db: Firestore,
  teamId: string,
  caller: Caller,
  input: { email: string; role?: InviteRole },
  now = Date.now(),
): Promise<Outcome<InviteResult>> {
  const email = normalizeEmail(input.email ?? "");
  if (!EMAIL.test(email)) {
    return fail(400, "That does not look like an email address.", "bad_request");
  }

  const role: InviteRole = input.role === "admin" ? "admin" : "member";

  const members = await db.collection("teams").doc(teamId).collection("members").get();
  if (members.docs.some((doc) => normalizeEmail((doc.get("email") as string) ?? "") === email)) {
    return fail(409, "They are already on this team.", "already_member");
  }

  const existing = await db
    .collection("invites")
    .where("teamId", "==", teamId)
    .where("email", "==", email)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) {
    return fail(409, "They already have a pending invitation.", "already_invited");
  }

  const plan = await planForTeam(db, teamId);
  const seats = await checkSeatLimit(db, teamId, plan);
  if (!seats.allowed) {
    return fail(
      403,
      "The free plan covers one person. Upgrade to invite teammates.",
      "upgrade_required",
    );
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = now + INVITE_TTL_MS;
  const ref = db.collection("invites").doc();
  await ref.set({
    teamId,
    email,
    role,
    token,
    status: "pending",
    invitedBy: caller.uid,
    invitedByName: caller.name ?? caller.email,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, inviteId: ref.id, token, email, role, expiresAt };
}

export type AcceptedInvite = {
  teamId: string;
  systemId: string;
  role: InviteRole;
  teamName: string;
};

/**
 * Accept an invitation.
 *
 * Marking the invite accepted and writing the membership happen in one
 * transaction: a token that has been spent must never be spendable again, and
 * a membership must never exist without the invite that justified it.
 */
export async function acceptInvite(
  db: Firestore,
  caller: Caller,
  token: string,
  now = Date.now(),
): Promise<Outcome<AcceptedInvite>> {
  if (!token.trim()) return fail(400, "An invitation token is required.", "bad_request");

  const found = await db
    .collection("invites")
    .where("token", "==", token.trim())
    .limit(1)
    .get();
  if (found.empty) return fail(404, "That invitation is not valid.", "invalid_token");

  const inviteRef = found.docs[0]!.ref;
  const invite = found.docs[0]!.data();

  if (invite.status !== "pending") {
    return fail(409, "That invitation has already been used.", "expired");
  }
  if (typeof invite.expiresAt === "number" && invite.expiresAt < now) {
    return fail(410, "That invitation has expired. Ask for a fresh one.", "expired");
  }

  const teamId = invite.teamId as string;
  const role = (invite.role as InviteRole) ?? "member";
  const teamRef = db.collection("teams").doc(teamId);
  const memberRef = teamRef.collection("members").doc(caller.uid);

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(inviteRef);
    if (fresh.get("status") !== "pending") throw new Error("already_used");
    tx.set(inviteRef, { status: "accepted", acceptedAt: now, acceptedBy: caller.uid }, { merge: true });
    tx.set(
      memberRef,
      {
        uid: caller.uid,
        email: caller.email,
        name: caller.name,
        picture: caller.picture,
        role,
        joinedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  const team = await teamRef.get();
  return {
    ok: true,
    teamId,
    systemId: (team.get("defaultSystemId") as string) ?? `sys_${teamId}`,
    role,
    teamName: (team.get("name") as string) ?? "team",
  };
}

export async function revokeInvite(
  db: Firestore,
  teamId: string,
  inviteId: string,
): Promise<Outcome> {
  const ref = db.collection("invites").doc(inviteId);
  const doc = await ref.get();
  if (!doc.exists || doc.get("teamId") !== teamId) {
    return fail(404, "No such invitation.", "not_found");
  }
  if (doc.get("status") !== "pending") {
    return fail(409, "That invitation is no longer pending.", "expired");
  }
  await ref.set({ status: "revoked", revokedAt: Date.now() }, { merge: true });
  return { ok: true };
}

/**
 * Remove a member.
 *
 * The owner cannot be removed, including by themselves: a team with no owner
 * has nobody who can pay for it or delete it.
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
