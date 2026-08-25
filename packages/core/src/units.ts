/** Root font size assumed when converting rem/em to px. */
export const ROOT_FONT_PX = 16;

/**
 * Convert a CSS length to pixels so "0.875rem" and "14px" compare equal.
 * Unitless numbers (line-height: 1.5, font-weight: 600) are returned as-is,
 * which is what we want: they are compared on their own scales.
 */
export function toPx(value: string): number | null {
  const raw = value.trim().toLowerCase();
  const match = /^(-?\d*\.?\d+)(px|rem|em|pt|%)?$/.exec(raw);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  switch (match[2]) {
    case "px":
    case undefined:
      return n;
    case "rem":
    case "em":
      return n * ROOT_FONT_PX;
    case "pt":
      return (n * 96) / 72;
    default:
      // % and anything else is not comparable to a fixed scale.
      return null;
  }
}

/** Two lengths are the same when they land on the same pixel (within rounding). */
export function sameLength(a: string, b: string): boolean {
  const pa = toPx(a);
  const pb = toPx(b);
  if (pa === null || pb === null) return a.trim() === b.trim();
  return Math.abs(pa - pb) < 0.01;
}

export function lengthDistance(a: string, b: string): number | null {
  const pa = toPx(a);
  const pb = toPx(b);
  if (pa === null || pb === null) return null;
  return Math.abs(pa - pb);
}
