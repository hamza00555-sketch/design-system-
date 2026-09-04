/**
 * Component previews are drawn from styles an *agent* wrote, so they are
 * untrusted input that ends up in a browser's style attribute. This module is
 * the gate: an allowlist of properties that can only ever affect the inside of
 * a preview box, and a value filter that refuses anything which could fetch a
 * resource, escape the box, or smuggle in more CSS.
 */

import type { ComponentPreview, PreviewState } from "./schema.js";

/**
 * Properties a preview legitimately needs. Deliberately excludes `position`,
 * `z-index`, `transform`, `content`, and anything else that could let a sample
 * button cover the page it is drawn on.
 */
const ALLOWED = new Set([
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-style",
  "border-width",
  "border-radius",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "box-shadow",
  "color",
  "opacity",
  "outline",
  "outline-offset",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "min-width",
  "min-height",
  "width",
  "height",
  "display",
  "align-items",
  "justify-content",
  "flex-direction",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "white-space",
  "cursor",
  "filter",
  "backdrop-filter",
]);

/** Anything that fetches, imports, or breaks out of a declaration. */
const FORBIDDEN_VALUE = /url\(|@import|expression\(|javascript:|<|>|[;{}]|\\/i;

/** Lengths large enough to escape a preview card are clamped away. */
const SIZE_PROPS = new Set(["width", "height", "min-width", "min-height"]);
const MAX_PREVIEW_PX = 640;

function toKebab(property: string): string {
  return property
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function toCamel(property: string): string {
  return property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function tooLarge(kebab: string, value: string): boolean {
  if (!SIZE_PROPS.has(kebab)) return false;
  const px = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (px) return Number(px[1]) > MAX_PREVIEW_PX;
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(value.trim());
  if (rem) return Number(rem[1]) * 16 > MAX_PREVIEW_PX;
  // Viewport and percentage units are relative to things outside the box.
  return /v(w|h|min|max)\b/.test(value);
}

/**
 * Filter agent-supplied styles down to what is safe to render, keyed the way
 * React wants them. Unknown properties are dropped silently: a preview that
 * renders slightly plain is a far better outcome than one that does not render
 * at all, and the tokens remain the source of truth either way.
 */
export function safeStyles(styles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawProperty, rawValue] of Object.entries(styles)) {
    const kebab = toKebab(rawProperty);
    if (!ALLOWED.has(kebab)) continue;
    const value = String(rawValue).trim();
    if (!value || value.length > 300) continue;
    if (FORBIDDEN_VALUE.test(value)) continue;
    if (tooLarge(kebab, value)) continue;
    out[toCamel(kebab)] = value;
  }
  return out;
}

export interface SafePreviewState extends Omit<PreviewState, "styles"> {
  styles: Record<string, string>;
}

export interface SafePreview extends Omit<ComponentPreview, "states"> {
  states: SafePreviewState[];
}

/** The whole preview, sanitised. Returns null when nothing renderable is left. */
export function safePreview(preview: ComponentPreview | undefined): SafePreview | null {
  if (!preview) return null;
  const states = preview.states
    .slice(0, 8)
    .map((state) => ({ ...state, styles: safeStyles(state.styles) }));
  if (states.length === 0) return null;
  return { ...preview, states };
}
