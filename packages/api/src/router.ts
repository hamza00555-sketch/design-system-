import { BRAND } from "@miswadah/core";
import {
  addScreen,
  getDesignSystem,
  getScreen,
  listScreensFor,
  removeScreen,
  handleMcpHttp,
  pushDesignSystem,
  verifyFiles,
} from "@miswadah/mcp";
import type { Firestore } from "firebase-admin/firestore";
import { canBootstrap } from "./access.js";
import { canManageTeam, memberRole, verifyCaller, type Caller } from "./auth.js";
import { applyStripeEvent, stripeGateway } from "./billing.js";
import { billingEnabled, checkProjectLimit, planForTeam } from "./plans.js";
import { createProject, redeemConnectCode } from "./connect.js";
import { mintConnectCode } from "./connectCodes.js";
import { FirestoreStore } from "./firestoreStore.js";
import { acceptInvite, inviteMember, removeMember, revokeInvite } from "./invites.js";
import { bootstrapWorkspace, createSystem } from "./teams.js";
import { restoreVersionForTeam } from "./versions.js";

/**
 * Only what a response has to offer this module. Firebase hands the handler
 * Express's response and Next hands it Node's; naming the shared surface keeps
 * this file free of both.
 */
export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
}

/** Likewise for the request: the fields every host already provides. */
export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** The exact bytes, needed to check Stripe's signature. */
  rawBody?: Buffer | string;
}

const appUrl = () => process.env.APP_URL ?? "http://127.0.0.1:3100";

/** Node allows a header to arrive repeated; the first value is the one meant. */
function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Every surface, on any host:
 *
 *   POST /mcp                     the MCP endpoint every agent talks to
 *   POST /api/cli/connect         `miswadah init` redeems a connect code
 *   POST /api/stripe/webhook      Stripe tells us who has paid
 *   POST /api/me/*                the app, as a signed-in person
 *   POST /api/{team-scoped}/*     the app, as a member of one team
 *
 * The three groups authenticate differently on purpose: the CLI has no signed
 * -in user (the connect code *is* the credential), Stripe proves itself with a
 * signature over the raw body, and the app carries a Firebase ID token.
 */

type Json = Record<string, unknown>;

const fail = (res: ApiResponse, status: number, error: string, code: string) => {
  res.status(status).json({ error, code });
};

/** Handlers that need a signed-in person but no particular team. */
const AUTHED: Record<string, (ctx: AuthedCtx) => Promise<void>> = {
  "/api/me/bootstrap": async ({ db, res, caller }) => {
    // Signing in is not the same as being allowed in: Firebase Auth will make
    // an account for anyone, so the door is here.
    const access = await canBootstrap(db, caller);
    if (!access.allowed) {
      fail(res, 403, access.error, access.code);
      return;
    }
    res.status(200).json(await bootstrapWorkspace(db, caller));
  },

  "/api/invites/accept": async ({ db, res, caller, body }) => {
    const result = await acceptInvite(db, caller, String(body.token ?? ""));
    respond(res, result, 200);
  },
};

/**
 * The paths an agent reaches with a project key.
 *
 * Listed explicitly rather than matched by `/api/systems/` prefix: the team
 * carries its own /api/systems routes, authenticated by a signed-in person
 * rather than a key, and a prefix match silently swallowed them.
 */
export const AGENT_PATHS = new Set([
  "/api/systems/current",
  "/api/systems/push",
  "/api/systems/screens",
  "/api/systems/screen",
  "/api/systems/verify",
]);

/** Handlers that act on one team, and require membership in it. */
const TEAM_SCOPED: Record<string, (ctx: TeamCtx) => Promise<void>> = {
  // Creating a project straight from the dashboard, so the connect screen can
  // hand over a ready prompt with a key in it. The CLI path still exists; this
  // is the one that needs no terminal.
  // A team holds many design systems, one per product. The name is the only
  // thing to decide; everything else hangs off the id this returns.
  "/api/systems/create": async ({ db, res, caller, teamId, body }) => {
    const name = String(body.name ?? "").trim();
    if (!name) return fail(res, 400, "A system needs a name.", "bad_request");
    res.status(201).json(await createSystem(db, { teamId, name, createdBy: caller.uid }));
  },

  "/api/projects/create": async ({ db, res, caller, teamId, body }) => {
    const systemId = String(body.systemId ?? "");
    if (!systemId) return fail(res, 400, "systemId is required.", "bad_request");

    const plan = await planForTeam(db, teamId);
    const limit = await checkProjectLimit(db, teamId, plan);
    if (!limit.allowed) {
      return fail(
        res,
        403,
        "The free plan covers one project. Upgrade to add another.",
        "upgrade_required",
      );
    }

    const result = await createProject(db, {
      teamId,
      systemId,
      name: String(body.name ?? "project"),
      repoName: body.repoName ? String(body.repoName) : undefined,
      createdBy: caller.uid,
    });
    res.status(201).json(result);
  },

  "/api/connect-codes": async ({ db, res, caller, teamId, body }) => {
    const systemId = String(body.systemId ?? "");
    if (!systemId) return fail(res, 400, "systemId is required.", "bad_request");
    res.status(201).json(await mintConnectCode(db, teamId, systemId, caller.uid));
  },

  "/api/versions/restore": async ({ db, res, teamId, body }) => {
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

  "/api/members/invite": async ({ db, res, caller, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can invite people.", "forbidden");
    }
    const result = await inviteMember(db, teamId, caller, {
      email: String(body.email ?? ""),
      role: body.role === "admin" ? "admin" : "member",
    });
    respond(res, result, 201);
  },

  "/api/members/revoke": async ({ db, res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage invitations.", "forbidden");
    }
    respond(res, await revokeInvite(db, teamId, String(body.inviteId ?? "")), 200);
  },

  "/api/members/remove": async ({ db, res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can remove people.", "forbidden");
    }
    respond(res, await removeMember(db, teamId, String(body.uid ?? "")), 200);
  },

  "/api/billing/checkout": async ({ db, res, caller, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage billing.", "forbidden");
    }
    const gateway = billing();
    if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

    const team = await db.collection("teams").doc(teamId).get();
    const locale = body.locale === "ar" ? "ar" : "en";
    const base = appUrl().replace(/\/+$/, "");
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

  "/api/billing/portal": async ({ db, res, teamId, role, body }) => {
    if (!canManageTeam(role)) {
      return fail(res, 403, "Only owners and admins can manage billing.", "forbidden");
    }
    const gateway = billing();
    if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

    const team = await db.collection("teams").doc(teamId).get();
    const customerId = team.get("stripeCustomerId") as string | undefined;
    if (!customerId) return fail(res, 409, "This team has no subscription yet.", "no_subscription");

    const locale = body.locale === "ar" ? "ar" : "en";
    const base = appUrl().replace(/\/+$/, "");
    const { url } = await gateway.createPortalSession({
      customerId,
      returnUrl: `${base}/${locale}/settings/billing`,
    });
    res.status(200).json({ url });
  },
};

interface AuthedCtx {
  db: Firestore;
  res: ApiResponse;
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

function respond(res: ApiResponse, result: Outcome, okStatus: number): void {
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
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const price = process.env.STRIPE_PRICE_ID ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!key || !price) return null;
  return stripeGateway(key, price, secret);
}

/**
 * Handle one request. `path` is normalised by the host adapter, because
 * Firebase and Next disagree about where a request's path lives.
 */
export async function handleApiRequest(
  db: Firestore,
  path: string,
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const store = new FirestoreStore(db);
  {
    if (path === "/mcp" || path === "/api/mcp") {
      await handleMcpHttp(req as never, res as never, store);
      return;
    }

    // The same three things MCP offers, over plain HTTP. An agent that was
    // handed a URL and a key in a prompt can use them with one fetch, without
    // a .mcp.json, a CLI, or a terminal. MCP stays the better path for
    // continuous work — it is what makes an agent verify without being asked.
    if (AGENT_PATHS.has(path)) {
      const key = header(req, "authorization")?.replace(/^Bearer\s+/i, "").trim();
      if (!key) {
        return fail(res, 401, "Missing Bearer project key.", "invalid_token");
      }
      const ctx = await store.resolveKey(key);
      if (!ctx) {
        return fail(res, 401, "Unknown project key.", "invalid_token");
      }

      if (path === "/api/systems/current") {
        res.status(200).json({ system: await getDesignSystem(store, ctx) });
        return;
      }
      if (path === "/api/systems/push") {
        const body = (req.body ?? {}) as Json;
        try {
          const system = body.system ?? body;
          res.status(200).json({ result: await pushDesignSystem(store, ctx, system) });
        } catch (err) {
          fail(
            res,
            400,
            err instanceof Error ? err.message : "That is not a valid design system.",
            "bad_request",
          );
        }
        return;
      }
      if (path === "/api/systems/screens") {
        // GET answers the question that matters when pictures go missing:
        // which system did this key actually write to, and what is in it? It
        // reads as the server, so it is also the one view that is unaffected
        // by Firestore's security rules.
        if (req.method === "GET") {
          res.status(200).json(await listScreensFor(store, ctx));
          return;
        }

        if (req.method === "DELETE") {
          const body = (req.body ?? {}) as Json;
          const result = await removeScreen(store, ctx, String(body.name ?? ""));
          if (result.error) {
            return fail(res, result.deleted === null ? 404 : 400, result.error, "not_found");
          }
          res.status(200).json({ systemId: ctx.systemId, ...result });
          return;
        }

        const body = (req.body ?? {}) as Json;
        res.status(200).json({
          systemId: ctx.systemId,
          result: await addScreen(store, ctx, {
            name: String(body.name ?? ""),
            description: body.description ? String(body.description) : undefined,
            data: String(body.data ?? ""),
            mimeType: String(body.mimeType ?? ""),
            kind: body.kind === "impression" ? "impression" : "capture",
          }),
        });
        return;
      }

      // One picture, by name, with its bytes. Without this the plain-HTTP
      // path could list what exists and never look at any of it, while the
      // MCP path could — and it is the HTTP path that a pasted prompt uses.
      if (path === "/api/systems/screen") {
        const body = (req.body ?? {}) as Json;
        const result = await getScreen(store, ctx, String(body.name ?? ""));
        if (!result.image) return fail(res, 404, result.text, "not_found");
        res.status(200).json({
          systemId: ctx.systemId,
          name: result.text,
          mimeType: result.image.mimeType,
          data: result.image.data,
        });
        return;
      }

      if (path === "/api/systems/verify") {
        const body = (req.body ?? {}) as Json;
        const files = Array.isArray(body.files) ? (body.files as never[]) : [];
        if (files.length === 0) {
          return fail(res, 400, "files is required.", "bad_request");
        }
        res.status(200).json({ result: await verifyFiles(store, ctx, files) });
        return;
      }
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

    const caller = await verifyCaller(header(req, "authorization"));
    if (!caller) return fail(res, 401, "Sign in first.", "invalid_token");
    const body = (req.body ?? {}) as Json;

    if (authed) {
      await authed({ db, res, caller, body });
      return;
    }

    const teamId = String(body.teamId ?? "");
    if (!teamId) return fail(res, 400, "teamId is required.", "bad_request");
    const role = await memberRole(db, teamId, caller.uid);
    if (role === null) return fail(res, 403, "Not a member of that team.", "forbidden");

    await teamScoped!({ db, res, caller, body, teamId, role });
  }
}

/**
 * Stripe proves itself with a signature over the exact bytes it sent, so this
 * path must never look at the parsed body.
 */
async function handleStripeWebhook(
  database: Firestore,
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const gateway = billing();
  if (!gateway) return fail(res, 503, "Billing is not configured.", "not_configured");

  const signature = header(req, "stripe-signature");
  if (!signature) {
    return fail(res, 400, "Missing Stripe signature.", "bad_request");
  }

  // Stripe signs the exact bytes it sent. A host whose body parser consumed
  // them cannot verify anything, and quietly trusting the parsed body instead
  // would accept forged events.
  if (req.rawBody === undefined) {
    return fail(
      res,
      400,
      "The raw request body was not preserved, so the signature cannot be checked.",
      "bad_request",
    );
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
