import type { DesignSystem, DimensionToken } from "./schema.js";
import { countTokens } from "./schema.js";

/**
 * The style prompt: this design system as one block of text you can paste into
 * any agent, anywhere, with nothing else attached.
 *
 * It is not the same job as `renderForAgent`. That one talks to an agent that
 * is already connected — it can call `verify`, so the text can be terse and
 * point at tools. This one travels alone: a different chat, a different model,
 * a repo that has never heard of this product. So it carries every value it
 * needs, states the taste as well as the numbers, and ends with a checklist the
 * reader can apply by hand. Paste it and the work comes out in the same style.
 */

function list(record: Record<string, DimensionToken>): string {
  return Object.entries(record)
    .map(([name, token]) => `${name}: ${token.value}${token.usage ? `  — ${token.usage}` : ""}`)
    .join("\n");
}

function block(title: string, body: string): string[] {
  return body.trim() ? ["", `### ${title}`, "", body] : [];
}

function scaleSentence(record: Record<string, DimensionToken>): string {
  const values = Object.values(record).map((token) => token.value);
  return values.join(" · ");
}

export function toStylePrompt(system: DesignSystem): string {
  const t = system.tokens;
  const name = system.meta.name;
  const out: string[] = [`Design everything you build in the style of ${name}.`, ""];

  // The extracting agent's own description leads, because it saw the product
  // and this file only ever saw its numbers. The values then follow as the
  // part that has to be obeyed exactly.
  if (system.stylePrompt?.trim()) {
    out.push(system.stylePrompt.trim(), "");
  }

  out.push(
    "This is the complete style. It is closed: every colour, size, space, and",
    "radius you use must be one of the values below, verbatim. When nothing",
    "here fits, take the nearest value and say what you would have wanted —",
    "never invent a new one, never nudge a value by a pixel or a shade.",
    "",
    `## The tokens (${countTokens(system)})`,
  );

  const colors = Object.entries(t.color);
  if (colors.length > 0) {
    out.push(
      "",
      "### Colour",
      "",
      colors
        .map(([n, c]) => `${n}: ${c.value}${c.usage ? `  — ${c.usage}` : ""}`)
        .join("\n"),
      "",
      "Use each colour for the job named beside it. Do not reach for a colour",
      "because it looks right in isolation; reach for it because the role fits.",
    );
  }

  out.push(
    ...block("Type", [
      list(t.typography.families),
      list(t.typography.sizes),
      list(t.typography.weights),
      list(t.typography.lineHeights),
      list(t.typography.letterSpacing),
    ]
      .filter(Boolean)
      .join("\n")),
    ...block("Spacing", list(t.spacing)),
    ...block("Radius", list(t.radius)),
    ...block("Elevation", list(t.shadow)),
    ...block("Border", list(t.border)),
  );

  if (Object.keys(t.spacing).length > 0) {
    out.push(
      "",
      `Every gap, pad, and margin comes off this scale: ${scaleSentence(t.spacing)}.`,
      "A 14px gap is a mistake even when it looks fine.",
    );
  }

  if (system.components.length > 0) {
    out.push("", "## Components", "");
    for (const component of system.components) {
      out.push(`**${component.name}** — ${component.description || "no description"}`);
      if (component.anatomy) out.push(`Anatomy: ${component.anatomy}`);
      if (component.variants.length) out.push(`Variants: ${component.variants.join(", ")}`);
      if (component.tokensUsed.length) out.push(`Built from: ${component.tokensUsed.join(", ")}`);
      const states = component.preview?.states ?? [];
      for (const state of states) {
        const css = Object.entries(state.styles)
          .map(([property, value]) => `${property}: ${value}`)
          .join("; ");
        if (css) out.push(`- ${state.name} → ${css}`);
      }
      for (const item of component.dos) out.push(`- Do: ${item}`);
      for (const item of component.donts) out.push(`- Don't: ${item}`);
      out.push("");
    }
  }

  if (system.rules.length > 0) {
    out.push("## Rules", "");
    for (const rule of system.rules) {
      out.push(`- ${rule.severity === "must" ? "MUST" : "SHOULD"}: ${rule.statement}`);
    }
    out.push("");
  }

  out.push(
    "## Before you call it done",
    "",
    "Read back over what you wrote and check each line:",
    "",
    "1. Every colour is one of the hex values above — no near-misses, no opacity",
    "   tricks to fake a shade that is not on the list.",
    "2. Every spacing, font size, and radius is an exact value from its scale.",
    "3. Each component you used matches its description, variants, and rules.",
    "4. Anything you had to approximate is named in your reply, so it can be",
    "   fixed rather than quietly shipped.",
  );

  if (system.meta.notes) out.push("", `Notes on this system: ${system.meta.notes}`);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
