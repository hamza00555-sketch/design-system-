import type { DesignSystem } from "../schema.js";

/**
 * A complete, realistic design system used by tests, the docs, and the
 * dashboard's empty state. Values are original to this project.
 */
export const clearGlass: DesignSystem = {
  schemaVersion: 1,
  meta: {
    name: "Clear Glass",
    source: "code",
    extractedAt: "2026-01-01T00:00:00.000Z",
    notes: "Sample system — a calm, high-contrast product UI.",
  },
  tokens: {
    color: {
      primary: { value: "#2f6bff", usage: "Primary actions, links, focus rings" },
      primaryHover: { value: "#1f56e0", usage: "Hover state for primary actions" },
      ink: { value: "#0d1117", usage: "Body text and headings" },
      muted: { value: "#5c6570", usage: "Secondary text, captions" },
      border: { value: "#e3e6ea", usage: "Hairlines and card borders" },
      surface: { value: "#ffffff", usage: "Cards, sheets, inputs" },
      canvas: { value: "#f7f8fa", usage: "Page background" },
      danger: { value: "#d1394a", usage: "Destructive actions and errors" },
      success: { value: "#1f9d63", usage: "Confirmations" },
    },
    typography: {
      families: {
        sans: { value: "Inter, system-ui, sans-serif", usage: "Everything" },
        mono: { value: "ui-monospace, SFMono-Regular, monospace", usage: "Code and tokens" },
      },
      sizes: {
        xs: { value: "12px" },
        sm: { value: "14px" },
        base: { value: "16px" },
        lg: { value: "20px" },
        xl: { value: "24px" },
        "2xl": { value: "32px" },
        "3xl": { value: "48px" },
      },
      weights: {
        regular: { value: "400" },
        medium: { value: "500" },
        semibold: { value: "600" },
      },
      lineHeights: {
        tight: { value: "1.2" },
        normal: { value: "1.5" },
        relaxed: { value: "1.7" },
      },
      letterSpacing: {
        tight: { value: "-0.02em" },
        normal: { value: "0em" },
      },
    },
    spacing: {
      xs: { value: "4px" },
      sm: { value: "8px" },
      md: { value: "16px" },
      lg: { value: "24px" },
      xl: { value: "32px" },
      "2xl": { value: "48px" },
      "3xl": { value: "64px" },
    },
    radius: {
      sm: { value: "4px" },
      md: { value: "8px" },
      lg: { value: "16px" },
      full: { value: "9999px" },
    },
    shadow: {
      sm: { value: "0 1px 2px rgba(13, 17, 23, 0.06)" },
      md: { value: "0 4px 16px rgba(13, 17, 23, 0.08)" },
    },
    border: {
      hairline: { value: "1px" },
      thick: { value: "2px" },
    },
  },
  components: [
    {
      name: "Button",
      description: "One primary action per view.",
      anatomy: "Label, optional leading icon, 8px gap.",
      variants: ["primary", "secondary", "ghost", "danger"],
      tokensUsed: ["color.primary", "radius.md", "spacing.sm", "typography.weights.medium"],
      dos: ["Use sentence case labels", "Keep the primary variant to one per screen"],
      donts: ["Never place two primary buttons side by side"],
    },
    {
      name: "Card",
      description: "A surface that groups related content.",
      anatomy: "16px padding, 1px border, 8px radius.",
      variants: ["default", "interactive"],
      tokensUsed: ["color.surface", "color.border", "radius.md", "spacing.md"],
      dos: ["Keep card padding on the spacing scale"],
      donts: ["Never nest a card inside a card"],
    },
  ],
  rules: [
    {
      id: "no-raw-color",
      statement: "Every colour must be a color token — never a raw hex.",
      severity: "must",
    },
    {
      id: "spacing-scale",
      statement: "Every gap, padding, and margin must land on the spacing scale.",
      severity: "must",
    },
    {
      id: "one-primary",
      statement: "One primary action per view.",
      severity: "should",
    },
  ],
};
