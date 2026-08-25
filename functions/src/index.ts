import { BRAND } from "@tokenwell/core";
import { handleMcpHttp } from "@tokenwell/mcp";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { isMember, verifyCaller } from "./auth.js";
import { redeemConnectCode } from "./connect.js";
import { mintConnectCode } from "./connectCodes.js";
import { FirestoreStore } from "./firestoreStore.js";
import { bootstrapWorkspace } from "./teams.js";
import { restoreVersionForTeam } from "./versions.js";

initializeApp();
const db = getFirestore();
const store = new FirestoreStore(db);

/**
 * One HTTP function serving both surfaces:
 *
 *   POST /mcp                 — the MCP endpoint every agent talks to
 *   POST /api/cli/connect     — `tokenwell init` redeems a connect code here
 *   POST /api/me/bootstrap    — the app, on sign-in: find or create a workspace
 *   POST /api/connect-codes   — the app: mint a code for the connect screen
 *   POST /api/versions/restore — the app: restore a version from history
 *
 * The two /api routes the app calls authenticate with a Firebase ID token; the
 * CLI route authenticates with the connect code itself, since the CLI has no
 * signed-in user.
 */
export const api = onRequest(
  { region: "us-central1", cors: false, maxInstances: 20, memory: "512MiB" },
  async (req, res) => {
    const path = req.path.replace(/\/+$/, "") || "/";

    if (path === "/mcp" || path === "/api/mcp") {
      await handleMcpHttp(req as never, res as never, store);
      return;
    }

    if (path === "/api/cli/connect") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "POST only.", code: "bad_request" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await redeemConnectCode(db, {
        code: String(body.code ?? ""),
        projectName: body.projectName ? String(body.projectName) : undefined,
        repoName: body.repoName ? String(body.repoName) : undefined,
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error, code: result.code });
        return;
      }
      res.status(201).json({ projectId: result.projectId, apiKey: result.apiKey });
      return;
    }

    if (
      path === "/api/me/bootstrap" ||
      path === "/api/connect-codes" ||
      path === "/api/versions/restore"
    ) {
      if (req.method !== "POST") {
        res.status(405).json({ error: "POST only.", code: "bad_request" });
        return;
      }
      const caller = await verifyCaller(req.headers.authorization);
      if (!caller) {
        res.status(401).json({ error: "Sign in first.", code: "invalid_token" });
        return;
      }

      if (path === "/api/me/bootstrap") {
        res.status(200).json(await bootstrapWorkspace(db, caller));
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const teamId = String(body.teamId ?? "");
      const systemId = String(body.systemId ?? "");
      if (!teamId || !systemId) {
        res.status(400).json({ error: "teamId and systemId are required.", code: "bad_request" });
        return;
      }
      if (!(await isMember(db, teamId, caller.uid))) {
        res.status(403).json({ error: "Not a member of that team.", code: "forbidden" });
        return;
      }
      if (path === "/api/connect-codes") {
        res.status(201).json(await mintConnectCode(db, teamId, systemId, caller.uid));
        return;
      }

      const versionId = String(body.versionId ?? "");
      if (!versionId) {
        res.status(400).json({ error: "versionId is required.", code: "bad_request" });
        return;
      }
      try {
        res.status(200).json(await restoreVersionForTeam(db, teamId, systemId, versionId));
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "No such version.",
          code: "bad_request",
        });
      }
      return;
    }

    if (path === "/api/health") {
      res.status(200).json({ ok: true, service: BRAND.cli });
      return;
    }

    res.status(404).json({ error: "Not found.", code: "bad_request" });
  },
);
