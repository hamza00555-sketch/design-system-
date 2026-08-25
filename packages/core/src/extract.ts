/**
 * Pull candidate visual values out of a source file.
 *
 * This is deliberately lexical rather than AST-based: the files an agent writes
 * are CSS, Tailwind-flavoured JSX, Vue SFCs, styled-components template
 * literals and plain HTML, and one scanner that understands "a colour literal
 * sitting in a style position" covers all of them.
 */

export type CandidateKind =
  | "color"
  | "spacing"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "radius"
  | "shadow";

export interface Candidate {
  kind: CandidateKind;
  /** The literal exactly as the author wrote it. */
  value: string;
  /** 1-indexed line in the file. */
  line: number;
  /** The CSS property or Tailwind prefix it appeared under, for the message. */
  property: string;
}

/** Values that carry no brand opinion — never worth reporting. */
const NEUTRAL = new Set([
  "0",
  "0px",
  "0rem",
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
  "normal",
  "currentcolor",
  "transparent",
  "100%",
  "50%",
  "fit-content",
  "max-content",
  "min-content",
]);

const SPACING_PROPS = new Set([
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-inline",
  "padding-block",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline",
  "margin-block",
  "gap",
  "row-gap",
  "column-gap",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
]);

const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "fill",
  "stroke",
  "caret-color",
  "text-decoration-color",
  "accent-color",
]);

const TW_COLOR_PREFIX = /\b(bg|text|border|fill|stroke|ring|divide|outline|from|via|to|shadow|decoration|accent)-\[([^\]\s]+)\]/g;
const TW_SPACING_PREFIX =
  /\b(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left)-\[([^\]\s]+)\]/g;
const TW_RADIUS = /\brounded(?:-[a-z]{1,2})?-\[([^\]\s]+)\]/g;
const TW_TEXT = /\btext-\[([^\]\s]+)\]/g;
const TW_LEADING = /\bleading-\[([^\]\s]+)\]/g;
const TW_TRACKING = /\btracking-\[([^\]\s]+)\]/g;
const TW_FONT_WEIGHT = /\bfont-\[(\d{2,3})\]/g;

const COLOR_LITERAL =
  /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]*\)/g;

const DECLARATION = /(^|[;{"'`\s])([a-z-]{3,30})\s*:\s*([^;{}"'`\n]+)/g;

/** A colour literal that is only part of a longer word (an id, a hash) is noise. */
function isStandaloneHex(source: string, index: number, value: string): boolean {
  const before = source[index - 1];
  const after = source[index + value.length];
  if (before && /[0-9a-zA-Z_-]/.test(before) && before !== "#") return false;
  if (after && /[0-9a-zA-Z_]/.test(after)) return false;
  return true;
}

/**
 * Blank out regions that look like style but are not: comments, SVG path data,
 * data URIs, and long base64 blobs. Replaced with spaces so line numbers and
 * offsets stay intact.
 */
export function maskNonStyleRegions(content: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return content
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)))
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\sd\s*=\s*("|')[\s\S]*?\1/g, blank)
    .replace(/url\(\s*(["']?)data:[\s\S]*?\1\s*\)/g, blank);
}

function isNeutral(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (NEUTRAL.has(v)) return true;
  // A token reference is by definition on-brand.
  if (v.startsWith("var(") || v.startsWith("theme(")) return true;
  // Percentages and viewport units are layout, not scale membership.
  if (/^-?\d*\.?\d+(%|vh|vw|vmin|vmax|fr|ch|ex)$/.test(v)) return true;
  return false;
}

function pushLengths(
  out: Candidate[],
  kind: CandidateKind,
  property: string,
  raw: string,
  line: number,
): void {
  // `padding: 12px 16px` carries two values; both must be on the scale.
  for (const part of raw.trim().split(/\s+/)) {
    if (isNeutral(part)) continue;
    if (!/^-?\d*\.?\d+(px|rem|em|pt)?$/.test(part)) continue;
    out.push({ kind, value: part, property, line });
  }
}

function lineOf(lineStarts: number[], index: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export function extractCandidates(content: string): Candidate[] {
  const masked = maskNonStyleRegions(content);
  const lineStarts = [0];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "\n") lineStarts.push(i + 1);
  }
  const at = (index: number) => lineOf(lineStarts, index);
  const out: Candidate[] = [];

  // 1. CSS-style declarations (also catches JSX style objects written as
  //    `style={{ padding: "14px" }}`? No — those use `:` too, so yes.)
  for (const m of masked.matchAll(DECLARATION)) {
    const property = m[2]!.toLowerCase();
    const raw = m[3]!.trim();
    const line = at(m.index! + m[1]!.length);
    if (isNeutral(raw)) continue;
    if (COLOR_PROPS.has(property)) {
      for (const c of raw.matchAll(COLOR_LITERAL)) {
        out.push({ kind: "color", value: c[0]!, property, line });
      }
      continue;
    }
    if (SPACING_PROPS.has(property)) pushLengths(out, "spacing", property, raw, line);
    else if (property === "font-size") pushLengths(out, "fontSize", property, raw, line);
    else if (property === "line-height") pushLengths(out, "lineHeight", property, raw, line);
    else if (property === "letter-spacing") pushLengths(out, "letterSpacing", property, raw, line);
    else if (property === "font-weight") pushLengths(out, "fontWeight", property, raw, line);
    else if (property.startsWith("border") && property.endsWith("radius")) {
      pushLengths(out, "radius", property, raw, line);
    } else if (property === "box-shadow" || property === "text-shadow") {
      out.push({ kind: "shadow", value: raw, property, line });
    }
  }

  // 2. Colour literals anywhere else (JSX props, template literals, config
  //    objects). A hex in a style position is a hex either way.
  const seen = new Set(out.filter((c) => c.kind === "color").map((c) => `${c.line}:${c.value}`));
  for (const m of masked.matchAll(COLOR_LITERAL)) {
    const value = m[0]!;
    if (value.startsWith("#") && !isStandaloneHex(masked, m.index!, value)) continue;
    const line = at(m.index!);
    const key = `${line}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "color", value, property: "color", line });
  }

  // 3. Tailwind arbitrary values — the most common way an agent smuggles an
  //    off-brand value past a design system.
  const tw = (
    re: RegExp,
    kind: CandidateKind,
    valueGroup: number,
    propGroup?: number,
  ) => {
    for (const m of masked.matchAll(re)) {
      const value = m[valueGroup]!.replace(/_/g, " ");
      if (isNeutral(value)) continue;
      const property = propGroup ? m[propGroup]! : kind;
      const line = at(m.index!);
      if (kind === "color") {
        if (!/^#|^(rgba?|hsla?|oklch|oklab|lab|lch)\(/.test(value)) continue;
        out.push({ kind: "color", value, property, line });
      } else {
        pushLengths(out, kind, property, value, line);
      }
    }
  };
  tw(TW_COLOR_PREFIX, "color", 2, 1);
  tw(TW_SPACING_PREFIX, "spacing", 2, 1);
  tw(TW_RADIUS, "radius", 1);
  tw(TW_LEADING, "lineHeight", 1);
  tw(TW_TRACKING, "letterSpacing", 1);
  tw(TW_FONT_WEIGHT, "fontWeight", 1);
  // text-[…] is a size when it reads as a length, a colour when it reads as one.
  for (const m of masked.matchAll(TW_TEXT)) {
    const value = m[1]!;
    const line = at(m.index!);
    if (/^#|^(rgba?|hsla?|oklch)\(/.test(value)) {
      out.push({ kind: "color", value, property: "text", line });
    } else {
      pushLengths(out, "fontSize", "text", value, line);
    }
  }

  return dedupe(out);
}

function dedupe(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of candidates) {
    const key = `${c.kind}|${c.value}|${c.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
