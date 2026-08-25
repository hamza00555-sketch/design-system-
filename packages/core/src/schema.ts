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

export const ComponentSpecSchema = z.object({
  name: nonEmpty,
  description: z.string().default(""),
  anatomy: z.string().optional(),
  variants: z.array(nonEmpty).default([]),
  tokensUsed: z.array(nonEmpty).default([]),
  dos: z.array(nonEmpty).default([]),
  donts: z.array(nonEmpty).default([]),
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
});

export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type DimensionToken = z.infer<typeof DimensionTokenSchema>;
export type Tokens = z.infer<typeof TokensSchema>;
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
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
