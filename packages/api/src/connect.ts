import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { generateProjectKey, hashKey, keyPrefixOf, normalizeConnectCode } from "./keys.js";
import { checkProjectLimit, planOf, PLANS } from "./plans.js";

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
export const FREE_PROJECT_LIMIT = PLANS.free.projects;
/** Connect codes are meant to be typed within a couple of minutes. */
export const CONNECT_CODE_TTL_MS = 15 * 60 * 1000;

export interface CreateProjectInput {
  teamId: string;
  systemId: string;
  name: string;
  repoName?: string;
  createdBy?: string;
}

/**
 * Register a project and mint its key.
 *
 * The key is returned here and never again — it exists in the clear only in
 * this response. Both ways in (a connect code from the CLI, or the dashboard
 * asking directly) land here, so there is one place that decides what a
 * project is.
 */
export async function createProject(
  db: Firestore,
  input: CreateProjectInput,
): Promise<{ projectId: string; apiKey: string }> {
  const apiKey = generateProjectKey();
  const projectRef = db.collection("projects").doc();
  const batch = db.batch();
  batch.set(projectRef, {
    teamId: input.teamId,
    systemId: input.systemId,
    name: input.name,
    repoName: input.repoName ?? null,
    keyPrefix: keyPrefixOf(apiKey),
    createdBy: input.createdBy ?? null,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null,
  });
  batch.set(db.collection("projectKeys").doc(hashKey(apiKey)), {
    projectId: projectRef.id,
    teamId: input.teamId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { projectId: projectRef.id, apiKey };
}

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
  const limit = await checkProjectLimit(db, teamId, planOf(team.get("plan")));
  if (!limit.allowed) {
    return {
      ok: false,
      status: 403,
      error: "The free plan covers one project. Upgrade to connect this repo as well.",
      code: "upgrade_required",
    };
  }

  const { projectId, apiKey } = await createProject(db, {
    teamId,
    systemId,
    name: request.projectName ?? "project",
    repoName: request.repoName,
  });
  await codeRef.set({ usedAt: now, usedByProject: projectId }, { merge: true });

  return { ok: true, projectId, apiKey };
}
