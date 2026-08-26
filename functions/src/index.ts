import { BRAND } from "@tokenwell/core";
import { handleMcpHttp } from "@tokenwell/mcp";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import type { Request } from "firebase-functions/v2/https";

/**
 * firebase-functions hands the handler Express's response but does not
 * re-export the type. Naming only what this file uses keeps the dependency
 * structural — and documents the whole surface in three lines.
 */
interface Response {
  status(code: number): Response;
  json(body: unknown): unknown;
}
import { canManageTeam, memberRole, verifyCaller, type Caller } from "./auth.js";
import { applyStripeEvent, stripeGateway } from "./billing.js";
import { billingEnabled } from "./plans.js";
import { redeemConnectCode } from "./connect.js";
import { mintConnectCode } from "./connectCodes.js";
import { FirestoreStore } from "./firestoreStore.js";
import { acceptInvite, inviteMember, removeMember, revokeInvite } from "./invites.js";
import { bootstrapWorkspace } from "./teams.js";
import { restoreVersionForTeam } from "./versions.js";

initializeApp();
const db = getFirestore();
const store = new FirestoreStore(db);

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_ID = defineString("STRIPE_PRICE_ID", { default: "" });
const APP_URL = defineString("APP_URL", { default: "http://127.0.0.1:3100" });

/**
 * One HTTP function serving every surface:
 *
 *   POST /mcp                     the MCP endpoint every agent talks to
 *   POST /api/cli/connect         `tokenwell init` redeems a connect code
 *   POST /api/stripe/webhook      Stripe tells us who has paid
 *   POST /api/me/*                the app, as a signed-in person
 *   POST /api/{team-scoped}/*     the app, as a member of one team
 *
 * The three groups authenticate differently on purpose: the CLI has no signed
 * -in user (the connect code *is* the credential), Stripe proves itself with a
 * signature over the raw body, and the app carries a Firebase ID token.
 */

type Json = Record<string, unknown>;

const fail = (res: Response, status: number, error: string, code: string) => {
  res.status(status).json({ error, code });
};

/** Handlers that need a signed-in person but no particular team. */
const AUTHED: Record<string, (ctx: AuthedCtx) => Promise<void>> = {
  "/api/me/bootstrap": async ({ res, caller }) => {
    res.status(200).json(await bootstrapWorkspace(db, caller));
  },

  "/api/invites/accept": async ({ res, caller, body }) => {
    const result = await acceptInvite(db, caller, String(body.token ?? ""));
    respond(res, result, 200);
  },
};

/** Handlers that act on one team, and require membership in it. */
const TEAM_SCOPED: Record<string, (ctx: TeamCtx) => Promise<void>> = {
  "/api/connect-codes": async ({ res, caller, teamId, body }) => {
    const systemId = String(body.systemId ?? "");
    if (!systemId) return fail(res, 400, "systemId is required.", "bad_request");
    res.status(201).json(await mintConnectCode(db, teamId, systemId, caller.uid));
  },

  "/api/versions/restore": async ({ res, teamId, body }) => {
    const systemId = String(body.systemId ?? "");
    const versionId = String(body.versionId ?? "");
    if (!systemId || !versionId) {
      return fail(res, 400, "systemId and versionId are required.", "bad_request");
    }
    try {
      res.status(200).json(await restoreVersionForTeam(db, teamId, systemId, versionId));
    } catch (err) {
      fail(res, 404, err instanceof Error ? err.message : "No such version.", "not_found");
    }
  },

  "/api/members/invite": async ({ res, caller, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can invite people.", "forbidden");
    }
    const result = await inviteMember(db, teamId, caller, {
      email: String(body.email ?? ""),
      role: body.role === "admin" ? "admin" : "member",
    });
    respond(res, result, 201);
  },

  "/api/members/revoke": async ({ res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage invitations.", "forbidden");
    }
    respond(res, await revokeInvite(db, teamId, String(body.inviteId ?? "")), 200);
  },

  "/api/members/remove": async ({ res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can remove people.", "forbidden");
    }
    respond(res, await removeMember(db, teamId, String(body.uid ?? "")), 200);
  },

  "/api/billing/checkout": async ({ res, caller, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage billing.", "forbidden");
    }
    const gateway = billing();
    if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

    const team = await db.collection("teams").doc(teamId).get();
    const locale = body.locale === "ar" ? "ar" : "en";
    const base = APP_URL.value().replace(/\/+$/, "");
    const { url } = await gateway.createCheckoutSession({
      teamId,
      uid: caller.uid,
      email: caller.email,
      customerId: (team.get("stripeCustomerId") as string | undefined) ?? undefined,
      successUrl: `${base}/${locale}/settings/billing?checkout=done`,
      cancelUrl: `${base}/${locale}/settings/billing?checkout=cancelled`,
    });
    res.status(200).json({ url });
  },

  "/api/billing/portal": async ({ res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage billing.", "forbidden");
    }
    const gateway = billing();
    if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

    const team = await db.collection("teams").doc(teamId).get();
    const customerId = team.get("stripeCustomerId") as string | undefined;
    if (!customerId) return fail(res, 409, "This team has no subscription yet.", "no_subscription");

    const locale = body.locale === "ar" ? "ar" : "en";
    const base = APP_URL.value().replace(/\/+$/, "");
    const { url } = await gateway.createPortalSession({
      customerId,
      returnUrl: `${base}/${locale}/settings/billing`,
    });
    res.status(200).json({ url });
  },
};

interface AuthedCtx {
  res: Response;
  caller: Caller;
  body: Json;
}

interface TeamCtx extends AuthedCtx {
  teamId: string;
  role: Awaited<ReturnType<typeof memberRole>>;
}

type Outcome =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; status: number; error: string; code: string };

function respond(res: Response, result: Outcome, okStatus: number): void {
  if (!result.ok) {
    fail(res, result.status, result.error, result.code);
    return;
  }
  const { ok, ...rest } = result;
  void ok;
  res.status(okStatus).json(rest);
}

function billing() {
  // Off by default. Keys alone do not open the upgrade path — BILLING_ENABLED
  // does, so a stray key in an environment cannot start charging anyone.
  if (!billingEnabled()) return null;
  const key = STRIPE_SECRET_KEY.value() || process.env.STRIPE_SECRET_KEY || "";
  const price = STRIPE_PRICE_ID.value() || process.env.STRIPE_PRICE_ID || "";
  const secret = STRIPE_WEBHOOK_SECRET.value() || process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!key || !price) return null;
  return stripeGateway(key, price, secret);
}

export const api = onRequest(
  {
    region: "us-central1",
    cors: false,
    maxInstances: 20,
    memory: "512MiB",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req: Request, res: Response) => {
    const path = req.path.replace(/\/+$/, "") || "/";

    if (path === "/mcp" || path === "/api/mcp") {
      await handleMcpHttp(req as never, res as never, store);
      return;
    }

    if (path === "/api/health") {
      res.status(200).json({ ok: true, service: BRAND.cli });
      return;
    }

    if (req.method !== "POST") return fail(res, 405, "POST only.", "bad_request");

    if (path === "/api/cli/connect") {
      const body = (req.body ?? {}) as Json;
      const result = await redeemConnectCode(db, {
        code: String(body.code ?? ""),
        projectName: body.projectName ? String(body.projectName) : undefined,
        repoName: body.repoName ? String(body.repoName) : undefined,
      });
      if (!result.ok) return fail(res, result.status, result.error, result.code);
      res.status(201).json({ projectId: result.projectId, apiKey: result.apiKey });
      return;
    }

    if (path === "/api/stripe/webhook") {
      await handleStripeWebhook(db, req, res);
      return;
    }

    const authed = AUTHED[path];
    const teamScoped = TEAM_SCOPED[path];
    if (!authed && !teamScoped) return fail(res, 404, "Not found.", "not_found");

    const caller = await verifyCaller(req.headers.authorization);
    if (!caller) return fail(res, 401, "Sign in first.", "invalid_token");
    const body = (req.body ?? {}) as Json;

    if (authed) {
      await authed({ res, caller, body });
      return;
    }

    const teamId = String(body.teamId ?? "");
    if (!teamId) return fail(res, 400, "teamId is required.", "bad_request");
    const role = await memberRole(db, teamId, caller.uid);
    if (role === null) return fail(res, 403, "Not a member of that team.", "forbidden");

    await teamScoped!({ res, caller, body, teamId, role });
  },
);

/**
 * Stripe proves itself with a signature over the exact bytes it sent, so this
 * path must never look at the parsed body.
 */
async function handleStripeWebhook(
  database: Firestore,
  req: Request,
  res: Response,
): Promise<void> {
  const gateway = billing();
  if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return fail(res, 400, "Missing Stripe signature.", "bad_request");
  }

  let event;
  try {
    event = gateway.constructEvent(req.rawBody, signature);
  } catch (err) {
    return fail(
      res,
      400,
      `Signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      "invalid_token",
    );
  }

  const result = await applyStripeEvent(database, event);
  // Always 200 once the signature checks out: a non-2xx makes Stripe retry, and
  // an event we do not act on is not a failure worth retrying.
  res.status(200).json(result);
}
