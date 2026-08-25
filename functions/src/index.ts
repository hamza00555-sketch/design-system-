import { BRAND } from "@tokenwell/core";
import { handleMcpHttp } from "@tokenwell/mcp";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { redeemConnectCode } from "./connect.js";
import { FirestoreStore } from "./firestoreStore.js";

initializeApp();
const db = getFirestore();
const store = new FirestoreStore(db);

/**
 * One HTTP function serving both surfaces:
 *
 *   POST /mcp               — the MCP endpoint every agent talks to
 *   POST /api/cli/connect   — `tokenwell init` redeems a connect code here
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

    if (path === "/api/health") {
      res.status(200).json({ ok: true, service: BRAND.cli });
      return;
    }

    res.status(404).json({ error: "Not found.", code: "bad_request" });
  },
);
