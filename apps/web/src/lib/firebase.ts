"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * The web app talks to Firestore directly for reads and to the Cloud Function
 * for anything that writes — the security rules make that split explicit, so
 * there is no privileged path through the browser.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const API_BASE = process.env.NEXT_PUBLIC_MISWADAH_API_BASE ?? "";

export function isConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && API_BASE);
}

const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function firebaseApp(): FirebaseApp {
  if (!isConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env.local and fill it in.",
    );
  }
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}

/**
 * Emulator wiring happens once, on first use: connectAuthEmulator throws if it
 * is called twice on the same instance, and React's strict mode calls
 * everything twice in development.
 */
export function auth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp());
    if (USE_EMULATORS) {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return authInstance;
}

export function db(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(firebaseApp());
    if (USE_EMULATORS) connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
  }
  return dbInstance;
}
