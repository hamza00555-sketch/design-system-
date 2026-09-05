import { z } from "zod";

/**
 * The design-system contract. Everything else in the product — extraction,
 * verification, export, storage — is defined against this shape, so it is the
 * one file to change when the system grows a new kind of token.
 */

const nonEmpty = z.string().min(1);

/** A CSS colour in any notation culori understands (hex, rgb, hsl, oklch, …). */
export const ColorTokenSchema = z.object({
  value: nonEmpty,
  usage: z.string().optional(),
});

/** A dimension token: "4px", "0.5rem", "1.5" (unitless line-height), … */
export const DimensionTokenSchema = z.object({
  value: nonEmpty,
  usage: z.string().optional(),
});

export const TypographySchema = z.object({
  families: z.record(nonEmpty, DimensionTokenSchema).default({}),
  sizes: z.record(nonEmpty, DimensionTokenSchema).default({}),
  weights: z.record(nonEmpty, DimensionTokenSchema).default({}),
  lineHeights: z.record(nonEmpty, DimensionTokenSchema).default({}),
  letterSpacing: z.record(nonEmpty, DimensionTokenSchema).default({}),
});

export const TokensSchema = z.object({
  color: z.record(nonEmpty, ColorTokenSchema).default({}),
  typography: TypographySchema.default({
    families: {},
    sizes: {},
    weights: {},
    lineHeights: {},
    letterSpacing: {},
  }),
  spacing: z.record(nonEmpty, DimensionTokenSchema).default({}),
  radius: z.record(nonEmpty, DimensionTokenSchema).default({}),
  shadow: z.record(nonEmpty, DimensionTokenSchema).default({}),
  border: z.record(nonEmpty, DimensionTokenSchema).default({}),
});

/**
 * One drawable state of a component: "default", "hover", "disabled".
 *
 * `styles` is plain CSS — property to value, as the component actually ships.
 * It exists so the dashboard can *draw* the button instead of describing it;
 * a rendered hover state answers "what does this look like" in a way that
 * `variants: ["primary"]` never will. Values are sanitised before they reach
 * a browser (see `safeStyles`), because they arrive from an agent.
 */
export const PreviewStateSchema = z.object({
  name: nonEmpty,
  styles: z.record(nonEmpty, nonEmpty).default({}),
  note: z.string().optional(),
});

export const PreviewElementSchema = z.enum([
  "button",
  "badge",
  "input",
  "card",
  "text",
  "surface",
]);

export const ComponentPreviewSchema = z.object({
  element: PreviewElementSchema.default("button"),
  /** The text drawn inside the sample. */
  label: z.string().optional(),
  states: z.array(PreviewStateSchema).default([]),
});

export const ComponentSpecSchema = z.object({
  name: nonEmpty,
  description: z.string().default(""),
  anatomy: z.string().optional(),
  variants: z.array(nonEmpty).default([]),
  tokensUsed: z.array(nonEmpty).default([]),
  dos: z.array(nonEmpty).default([]),
  donts: z.array(nonEmpty).default([]),
  preview: ComponentPreviewSchema.optional(),
});

export const RuleSchema = z.object({
  id: nonEmpty,
  statement: nonEmpty,
  severity: z.enum(["must", "should"]).default("must"),
});

export const SourceSchema = z.enum(["code", "image", "url", "manual"]);

export const DesignSystemSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  meta: z.object({
    name: nonEmpty,
    source: SourceSchema.default("code"),
    extractedAt: z.string().optional(),
    notes: z.string().optional(),
  }),
  tokens: TokensSchema,
  components: z.array(ComponentSpecSchema).default([]),
  rules: z.array(RuleSchema).default([]),
  /**
   * The style, in the extracting agent's own words.
   *
   * A style prompt can be derived from tokens, and `toStylePrompt` does derive
   * one — but the agent that read the code saw things the tokens cannot hold:
   * that the product is dense and quiet, that motion is used sparingly, that
   * cards never nest. It writes that down here, and the derived appendix
   * carries the exact values underneath it.
   */
  stylePrompt: z.string().optional(),
});

export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type DimensionToken = z.infer<typeof DimensionTokenSchema>;
export type Tokens = z.infer<typeof TokensSchema>;
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type ComponentPreview = z.infer<typeof ComponentPreviewSchema>;
export type PreviewState = z.infer<typeof PreviewStateSchema>;
export type PreviewElement = z.infer<typeof PreviewElementSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

/** Parse untrusted input (an agent push, a stored document) into a DesignSystem. */
export function parseDesignSystem(input: unknown): DesignSystem {
  return DesignSystemSchema.parse(input);
}

export function safeParseDesignSystem(input: unknown) {
  return DesignSystemSchema.safeParse(input);
}

/** Count of every token in the system — the "40 of 40 tokens" number. */
export function countTokens(system: DesignSystem): number {
  const t = system.tokens;
  return (
    Object.keys(t.color).length +
    Object.keys(t.spacing).length +
    Object.keys(t.radius).length +
    Object.keys(t.shadow).length +
    Object.keys(t.border).length +
    Object.keys(t.typography.families).length +
    Object.keys(t.typography.sizes).length +
    Object.keys(t.typography.weights).length +
    Object.keys(t.typography.lineHeights).length +
    Object.keys(t.typography.letterSpacing).length
  );
}
