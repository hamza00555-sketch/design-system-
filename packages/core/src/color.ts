import { converter, differenceCiede2000, parse as parseColor } from "culori";

const toLab = converter("lab65");
const deltaE = differenceCiede2000();

/**
 * Perceptual distance between two CSS colours (CIEDE2000 over CIELAB).
 * Returns null when either side is not a colour we can read.
 */
export function colorDistance(a: string, b: string): number | null {
  const left = parseColor(a);
  const right = parseColor(b);
  if (!left || !right) return null;
  const dl = toLab(left);
  const dr = toLab(right);
  if (!dl || !dr) return null;
  return deltaE(dl, dr);
}

/**
 * A generation counts as on-brand when it lands within this distance of a
 * token. ΔE 2.0 is the classic "a trained eye can just about tell them apart"
 * threshold — tight enough to catch a near-miss blue, loose enough to survive
 * hex rounding and colour-space round-trips.
 */
export const DELTA_E_THRESHOLD = 2;

export function isColor(value: string): boolean {
  return parseColor(value) !== undefined;
}

/** Normalise for display: keep what the author wrote, trimmed and lowercased. */
export function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}
