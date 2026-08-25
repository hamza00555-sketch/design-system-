"use client";

import { auth, API_BASE } from "./firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Call the Cloud Function as the signed-in user.
 *
 * The ID token is fetched per call rather than cached: the SDK hands back a
 * cached one until it is close to expiring, so this stays cheap and never
 * sends a token that has just gone stale.
 */
export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const user = auth().currentUser;
  if (!user) throw new ApiError("Not signed in.", "invalid_token", 401);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof payload.error === "string" ? payload.error : `Request failed (${res.status})`,
      typeof payload.code === "string" ? payload.code : "unknown",
      res.status,
    );
  }
  return payload as T;
}
