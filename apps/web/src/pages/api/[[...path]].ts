import { handleApiRequest } from "@miswadah/api";
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * The whole API, served by the site itself.
 *
 * This is the Vercel host for @miswadah/api. It exists because deploying
 * Cloud Functions requires Firebase's paid Blaze plan, while Firestore and
 * Auth are free on Spark — so the API moves to where the site already is, and
 * the project needs no billing account at all.
 *
 * Pages-router API routes rather than app-router handlers on purpose: the MCP
 * transport writes to a Node response, which is what this signature gives.
 */
export const config = {
  api: {
    // Read the body here instead. Stripe's signature covers the exact bytes it
    // sent, and Next's parser would consume them before anything could check.
    bodyParser: false,
  },
  maxDuration: 30,
};

const MAX_BODY = 4 * 1024 * 1024;

async function readBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Buffer);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("Request body too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // req.url is "/api/cli/connect?x=1"; the router wants the path alone, and
  // treats "/mcp" and "/api/mcp" as the same endpoint.
  const path = (req.url ?? "/").split("?")[0]!.replace(/\/+$/, "") || "/";

  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await readBody(req);
      (req as { rawBody?: Buffer }).rawBody = raw;
      const text = raw.toString("utf8");
      req.body = text ? (JSON.parse(text) as unknown) : undefined;
    }
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Could not read the request body.",
      code: "bad_request",
    });
    return;
  }

  try {
    await handleApiRequest(adminDb(), path, req as never, res as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("api error", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message, code: "server_error" });
    }
  }
}
