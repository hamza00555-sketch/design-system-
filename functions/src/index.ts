import { handleApiRequest } from "@miswadah/api";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

/**
 * The Firebase host for the API.
 *
 * Everything it serves lives in @miswadah/api; this file only translates
 * Firebase's request into the shape that package expects. The same API also
 * runs on Vercel (apps/web/src/pages/api), which is what a deployment on the
 * free Spark plan uses — Cloud Functions need the paid Blaze plan.
 */

initializeApp();
const db = getFirestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

export const api = onRequest(
  {
    region: "us-central1",
    cors: false,
    maxInstances: 20,
    memory: "512MiB",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const path = req.path.replace(/\/+$/, "") || "/";
    await handleApiRequest(db, path, req as never, res as never);
  },
);
