import type { DesignSystem, DimensionToken } from "./schema.js";
import { countTokens } from "./schema.js";

/**
 * What `get_design_system` hands an agent.
 *
 * Deliberately compact prose-and-lists rather than raw JSON: an agent follows
 * "use spacing.md (16px), never a value off this scale" far more reliably than
 * it follows a nested object it has to interpret first.
 */

function line(record: Record<string, DimensionToken>, label: string): string | null {
  const entries = Object.entries(record);
  if (entries.length === 0) return null;
  const body = entries
    .map(([name, token]) => `${name}=${token.value}${token.usage ? ` (${token.usage})` : ""}`)
    .join(", ");
  return `- ${label}: ${body}`;
}

export function renderForAgent(system: DesignSystem): string {
  const t = system.tokens;
  const out: string[] = [
    `# ${system.meta.name} — design system (${countTokens(system)} tokens)`,
    "",
    "Every visual value you write must come from this system. Never invent a",
    "colour, font size, weight, spacing step, or radius. When nothing here fits,",
    "pick the nearest token and say so — do not introduce a new value.",
    "",
    "## Tokens",
  ];

  const colors = Object.entries(t.color);
  if (colors.length > 0) {
    out.push(
      `- color: ${colors
        .map(([n, c]) => `${n}=${c.value}${c.usage ? ` (${c.usage})` : ""}`)
        .join(", ")}`,
    );
  }
  for (const l of [
    line(t.typography.families, "font family"),
    line(t.typography.sizes, "font size"),
    line(t.typography.weights, "font weight"),
    line(t.typography.lineHeights, "line height"),
    line(t.typography.letterSpacing, "letter spacing"),
    line(t.spacing, "spacing"),
    line(t.radius, "radius"),
    line(t.shadow, "shadow"),
    line(t.border, "border"),
  ]) {
    if (l) out.push(l);
  }

  if (system.components.length > 0) {
    out.push("", "## Components");
    for (const c of system.components) {
      out.push(`### ${c.name}`);
      if (c.description) out.push(c.description);
      if (c.anatomy) out.push(`Anatomy: ${c.anatomy}`);
      if (c.variants.length) out.push(`Variants: ${c.variants.join(", ")}`);
      if (c.tokensUsed.length) out.push(`Tokens: ${c.tokensUsed.join(", ")}`);
      for (const d of c.dos) out.push(`DO: ${d}`);
      for (const d of c.donts) out.push(`DON'T: ${d}`);
    }
  }

  if (system.rules.length > 0) {
    out.push("", "## Rules");
    for (const rule of system.rules) {
      out.push(`- [${rule.severity}] ${rule.statement}`);
    }
  }

  out.push(
    "",
    "After writing or editing any UI file, call `verify` with each file you",
    "touched and fix every value it reports before you finish.",
  );

  return out.join("\n");
}
