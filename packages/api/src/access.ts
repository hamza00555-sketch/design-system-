import type { Firestore } from "firebase-admin/firestore";
import type { Caller } from "./auth.js";

/**
 * Who may claim a workspace on this deployment.
 *
 * Open: anyone who reaches the URL and signs in gets a workspace. What they
 * get is their *own* — their own team, their own design systems — because
 * `bootstrapWorkspace` derives the team from the signing-in uid. Nobody
 * arrives inside somebody else's data by finding the link.
 *
 * `ALLOWED_EMAILS` closes it again, to those addresses only. Unset, which is
 * the default, means open.
 */

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; error: string; code: string };

const ALLOWED = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export async function canBootstrap(db: Firestore, caller: Caller): Promise<AccessDecision> {
  const allowlist = ALLOWED();
  if (allowlist.length === 0) return { allowed: true };

  // Anyone already on a team keeps their access, whatever the list says now.
  // Locking the door should not throw out the people already inside.
  const membership = await db
    .collectionGroup("members")
    .where("uid", "==", caller.uid)
    .limit(1)
    .get();
  if (!membership.empty) return { allowed: true };

  const email = caller.email?.trim().toLowerCase() ?? "";
  return allowlist.includes(email)
    ? { allowed: true }
    : {
        allowed: false,
        error: "This deployment is restricted to its owner's accounts.",
        code: "not_allowed",
      };
}
