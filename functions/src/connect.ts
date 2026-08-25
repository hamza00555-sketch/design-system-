import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { generateProjectKey, hashKey, keyPrefixOf, normalizeConnectCode } from "./keys.js";

export interface ConnectRequest {
  code: string;
  projectName?: string;
  repoName?: string;
}

export type ConnectResult =
  | { ok: true; projectId: string; apiKey: string }
  | { ok: false; status: number; error: string; code: ConnectErrorCode };

export type ConnectErrorCode = "invalid_token" | "expired" | "upgrade_required" | "bad_request";

/** How many projects a free team may connect. Paying starts at the second. */
export const FREE_PROJECT_LIMIT = 1;
/** Connect codes are meant to be typed within a couple of minutes. */
export const CONNECT_CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Redeem a connect code: register the repo as a project and mint its key.
 *
 * The code is single-use and short-lived, so a code pasted into a chat log is
 * worthless minutes later. The key is returned once and never stored in the
 * clear.
 */
export async function redeemConnectCode(
  db: Firestore,
  request: ConnectRequest,
  now = Date.now(),
): Promise<ConnectResult> {
  const code = normalizeConnectCode(request.code ?? "");
  if (!code) {
    return {
      ok: false,
      status: 400,
      error: "A connect code is required.",
      code: "bad_request",
    };
  }

  const codeRef = db.collection("connectCodes").doc(code);
  const codeDoc = await codeRef.get();
  if (!codeDoc.exists) {
    return {
      ok: false,
      status: 401,
      error: "Unknown connect code. Mint a fresh one from the dashboard.",
      code: "invalid_token",
    };
  }

  const data = codeDoc.data()!;
  if (data.usedAt) {
    return {
      ok: false,
      status: 401,
      error: "That connect code has already been used. Mint a fresh one.",
      code: "expired",
    };
  }
  if (typeof data.expiresAt === "number" && data.expiresAt < now) {
    return {
      ok: false,
      status: 401,
      error: "That connect code has expired. Mint a fresh one.",
      code: "expired",
    };
  }

  const teamId = data.teamId as string;
  const systemId = data.systemId as string;

  const team = await db.collection("teams").doc(teamId).get();
  const plan = team.get("plan") === "pro" ? "pro" : "free";
  if (plan === "free") {
    const existing = await db
      .collection("projects")
      .where("teamId", "==", teamId)
      .limit(FREE_PROJECT_LIMIT + 1)
      .get();
    if (existing.size >= FREE_PROJECT_LIMIT) {
      return {
        ok: false,
        status: 403,
        error:
          "The free plan covers one project. Upgrade to connect this repo as well.",
        code: "upgrade_required",
      };
    }
  }

  const apiKey = generateProjectKey();
  const projectRef = db.collection("projects").doc();
  const batch = db.batch();
  batch.set(projectRef, {
    teamId,
    systemId,
    name: request.projectName ?? "project",
    repoName: request.repoName ?? null,
    keyPrefix: keyPrefixOf(apiKey),
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null,
  });
  batch.set(db.collection("projectKeys").doc(hashKey(apiKey)), {
    projectId: projectRef.id,
    teamId,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(codeRef, { usedAt: now, usedByProject: projectRef.id }, { merge: true });
  await batch.commit();

  return { ok: true, projectId: projectRef.id, apiKey };
}
