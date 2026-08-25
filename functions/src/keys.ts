import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BRAND } from "@tokenwell/core";

/**
 * Project API keys. The plaintext key is shown once, at connect time, and
 * lives only in the repo's gitignored .mcp.json — we store the hash.
 */

export function generateProjectKey(): string {
  return `${BRAND.keyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** The first characters of the key, kept so a person can recognise it. */
export function keyPrefixOf(key: string): string {
  return key.slice(0, 16);
}

/** Codes people read off a screen and type into a terminal. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1

export function generateConnectCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function normalizeConnectCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
