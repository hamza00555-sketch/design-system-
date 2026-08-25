import { colorDistance, DELTA_E_THRESHOLD } from "./color.js";
import { extractCandidates, type Candidate, type CandidateKind } from "./extract.js";
import type { DesignSystem, DimensionToken } from "./schema.js";
import { lengthDistance, sameLength } from "./units.js";

export interface FileInput {
  path: string;
  content: string;
}

export interface Violation {
  path: string;
  line: number;
  kind: CandidateKind;
  /** The off-brand literal, as written. */
  found: string;
  /** The on-brand value to use instead. */
  suggestion: string;
  /** Dotted path of the token to reach for, e.g. "colors.primary". */
  tokenPath: string;
  /** One-line receipt, ready to show. */
  message: string;
  /** ΔE for colours, pixel distance for lengths. */
  distance?: number;
}

export interface VerifySummary {
  colors: number;
  type: number;
  spacing: number;
  radius: number;
  checked: number;
  offBrand: number;
}

export interface VerifyResult {
  pass: boolean;
  summary: VerifySummary;
  violations: Violation[];
  /** The single-line receipt the agent (and the dashboard) prints. */
  receipt: string;
}

const TYPE_KINDS: CandidateKind[] = ["fontSize", "fontWeight", "lineHeight", "letterSpacing"];

type Scale = { tokenPath: (name: string) => string; entries: [string, DimensionToken][] };

function scaleFor(system: DesignSystem, kind: CandidateKind): Scale | null {
  const t = system.tokens;
  const pick = (
    record: Record<string, DimensionToken>,
    prefix: string,
  ): Scale | null => {
    const entries = Object.entries(record);
    return entries.length ? { tokenPath: (n) => `${prefix}.${n}`, entries } : null;
  };
  switch (kind) {
    case "spacing":
      return pick(t.spacing, "spacing");
    case "radius":
      return pick(t.radius, "radius");
    case "shadow":
      return pick(t.shadow, "shadow");
    case "fontSize":
      return pick(t.typography.sizes, "typography.sizes");
    case "fontWeight":
      return pick(t.typography.weights, "typography.weights");
    case "lineHeight":
      return pick(t.typography.lineHeights, "typography.lineHeights");
    case "letterSpacing":
      return pick(t.typography.letterSpacing, "typography.letterSpacing");
    default:
      return null;
  }
}

function nearestColor(system: DesignSystem, value: string) {
  let best: { name: string; value: string; distance: number } | null = null;
  for (const [name, token] of Object.entries(system.tokens.color)) {
    const d = colorDistance(value, token.value);
    if (d === null) continue;
    if (!best || d < best.distance) best = { name, value: token.value, distance: d };
  }
  return best;
}

function nearestOnScale(scale: Scale, value: string) {
  let best: { name: string; value: string; distance: number } | null = null;
  for (const [name, token] of scale.entries) {
    const d = lengthDistance(value, token.value);
    if (d === null) continue;
    if (!best || d < best.distance) best = { name, value: token.value, distance: d };
  }
  return best ?? (scale.entries[0]
    ? { name: scale.entries[0][0], value: scale.entries[0][1].value, distance: Number.NaN }
    : null);
}

function checkCandidate(
  system: DesignSystem,
  path: string,
  candidate: Candidate,
): Violation | null {
  if (candidate.kind === "color") {
    if (Object.keys(system.tokens.color).length === 0) return null;
    const near = nearestColor(system, candidate.value);
    if (!near) return null;
    if (near.distance < DELTA_E_THRESHOLD) return null;
    const tokenPath = `color.${near.name}`;
    return {
      path,
      line: candidate.line,
      kind: "color",
      found: candidate.value,
      suggestion: near.value,
      tokenPath,
      distance: Number(near.distance.toFixed(2)),
      message: `${candidate.value} — off-brand · use ${tokenPath} (${near.value})`,
    };
  }

  const scale = scaleFor(system, candidate.kind);
  if (!scale) return null;
  if (scale.entries.some(([, token]) => sameLength(candidate.value, token.value))) return null;
  const near = nearestOnScale(scale, candidate.value);
  if (!near) return null;
  const tokenPath = scale.tokenPath(near.name);
  return {
    path,
    line: candidate.line,
    kind: candidate.kind,
    found: candidate.value,
    suggestion: near.value,
    tokenPath,
    distance: Number.isNaN(near.distance) ? undefined : near.distance,
    message: `${candidate.value} ${candidate.property} — off-grid · use ${tokenPath} (${near.value})`,
  };
}

function bucket(kind: CandidateKind): keyof VerifySummary | null {
  if (kind === "color") return "colors";
  if (kind === "spacing") return "spacing";
  if (kind === "radius") return "radius";
  if (TYPE_KINDS.includes(kind)) return "type";
  return null;
}

/**
 * Check written files against the design system.
 *
 * Colours pass within ΔE 2 of a token; every scale value (spacing, type,
 * radius) must land exactly on the scale. Anything else is reported with the
 * nearest on-brand token so the agent can fix it without guessing.
 */
export function verify(system: DesignSystem, files: FileInput[]): VerifyResult {
  const violations: Violation[] = [];
  const summary: VerifySummary = {
    colors: 0,
    type: 0,
    spacing: 0,
    radius: 0,
    checked: 0,
    offBrand: 0,
  };

  for (const file of files) {
    for (const candidate of extractCandidates(file.content)) {
      const b = bucket(candidate.kind);
      if (b) summary[b] += 1;
      summary.checked += 1;
      const violation = checkCandidate(system, file.path, candidate);
      if (violation) violations.push(violation);
    }
  }

  violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  summary.offBrand = violations.length;

  return {
    pass: violations.length === 0,
    summary,
    violations,
    receipt: formatReceipt(summary),
  };
}

export function formatReceipt(summary: VerifySummary): string {
  const head = `colors (${summary.colors}) · type (${summary.type}) · spacing (${summary.spacing})`;
  return summary.offBrand === 0
    ? `verify → pass · ${head} — 0 off-brand values`
    : `verify → fail · ${head} — ${summary.offBrand} off-brand value${summary.offBrand === 1 ? "" : "s"}`;
}
