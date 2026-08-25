import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { CONNECT_CODE_TTL_MS } from "./connect.js";
import { generateConnectCode, normalizeConnectCode } from "./keys.js";

export interface MintedCode {
  code: string;
  expiresAt: number;
}

/**
 * Mint a connect code for a system.
 *
 * Short-lived and single-use by design: the code travels through a screen, a
 * clipboard, and a shell history, so it has to be worthless minutes later.
 */
export async function mintConnectCode(
  db: Firestore,
  teamId: string,
  systemId: string,
  uid: string,
  now = Date.now(),
): Promise<MintedCode> {
  const code = generateConnectCode();
  const expiresAt = now + CONNECT_CODE_TTL_MS;
  await db
    .collection("connectCodes")
    .doc(normalizeConnectCode(code))
    .set({
      teamId,
      systemId,
      createdBy: uid,
      expiresAt,
      usedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  return { code, expiresAt };
}
