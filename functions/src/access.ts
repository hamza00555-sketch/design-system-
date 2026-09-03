import type { Firestore } from "firebase-admin/firestore";
import type { Caller } from "./auth.js";

/**
 * Who may claim a workspace on this deployment.
 *
 * A personal instance is only personal if the sign-up door is shut. Firebase
 * Auth will happily create an account for anyone with a Google account who
 * finds the URL, so the check has to live here.
 *
 * The default is self-securing and needs no configuration: the first person to
 * sign in claims the instance, and after that it is invitation-only. That is
 * the right behaviour for a deployment of one, and it fails closed if someone
 * forgets to set anything.
 */

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; error: string; code: string };

const ALLOWED = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

/** Set OPEN_SIGNUPS=1 to run this as a public product again. */
export function openSignups(): boolean {
  return process.env.OPEN_SIGNUPS === "1";
}

export async function canBootstrap(db: Firestore, caller: Caller): Promise<AccessDecision> {
  if (openSignups()) return { allowed: true };

  // Anyone already on a team keeps their access, whatever the rules say now —
  // including people who joined by invitation.
  const membership = await db
    .collectionGroup("members")
    .where("uid", "==", caller.uid)
    .limit(1)
    .get();
  if (!membership.empty) return { allowed: true };

  const allowlist = ALLOWED();
  const email = caller.email?.trim().toLowerCase() ?? "";
  if (allowlist.length > 0) {
    return allowlist.includes(email)
      ? { allowed: true }
      : {
          allowed: false,
          error: "This deployment is private. Ask its owner for an invitation.",
          code: "not_allowed",
        };
  }

  // No allowlist configured: the instance is unclaimed until someone takes it.
  const existing = await db.collection("teams").limit(1).get();
  if (existing.empty) return { allowed: true };

  return {
    allowed: false,
    error: "This deployment is private. Ask its owner for an invitation.",
    code: "not_allowed",
  };
}
