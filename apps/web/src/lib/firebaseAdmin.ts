import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase, for the API routes.
 *
 * On a Firebase host the credentials come from the environment. Here they do
 * not, so a service-account key is passed in FIREBASE_SERVICE_ACCOUNT — the
 * whole JSON file, pasted into one variable. It is a secret with full access
 * to the project: it must never be a NEXT_PUBLIC_ variable, and it never
 * reaches the browser because nothing in src/pages/api does.
 */
/** The emulators accept any project and check no credentials. */
const emulated = () => Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set. Paste the service-account JSON into " +
        "that environment variable — see DEPLOY.md.",
    );
  }
  try {
    return JSON.parse(raw) as { project_id: string };
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole downloaded " +
        "file, braces included.",
    );
  }
}

let app: App | null = null;

export function adminDb(): Firestore {
  if (!app) {
    if (getApps().length) {
      app = getApp();
    } else if (emulated()) {
      // Local development: no key needed, and none should be lying around.
      // Server-side variables first — NEXT_PUBLIC_ ones are baked in at build
      // time, so a stale .env.local silently outranks the real environment.
      app = initializeApp({
        projectId:
          process.env.FIREBASE_PROJECT_ID ??
          process.env.GCLOUD_PROJECT ??
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
          "demo-miswadah",
      });
    } else {
      const serviceAccount = credentials();
      app = initializeApp({
        credential: cert(serviceAccount as never),
        projectId: serviceAccount.project_id,
      });
    }
  }
  return getFirestore(app);
}
