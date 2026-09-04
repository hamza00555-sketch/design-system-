"use client";

import {
  safePreview,
  toPx,
  type DesignSystem,
  type DimensionToken,
  type PreviewElement,
} from "@miswadah/core";
import { useTranslations } from "next-intl";

/**
 * The system, drawn rather than listed.
 *
 * A design system is a visual thing, and a table of hex codes is the slowest
 * possible way to look at one. So every token here renders as itself: the
 * shadow is cast on a real card, the spacing step is a bar at its own width,
 * the radius is a corner you can see, the type sample is set at its own size.
 * Components go further and draw each state — a disabled button that looks
 * disabled says more than the word "disabled" ever did.
 *
 * Values stay LTR: `#2f6bff` and `16px` read the same way in every language.
 */
export function TokenGrid({ system }: { system: DesignSystem }) {
  const t = useTranslations("tokens");
  const { tokens } = system;
  const type = tokens.typography;

  return (
    <div className="flex flex-col gap-10">
      <ColorSection title={t("color")} tokens={tokens.color} />
      <ComponentSection title={t("components")} components={system.components} t={t} />
      <SpacingSection title={t("spacing")} tokens={tokens.spacing} />
      <RadiusSection title={t("radius")} tokens={tokens.radius} />
      <ShadowSection title={t("shadow")} tokens={tokens.shadow} />

      <SampleSection
        title={t("families")}
        tokens={type.families}
        sample={(value) => ({ fontFamily: value, fontSize: "20px" })}
      />
      <SampleSection
        title={t("sizes")}
        tokens={type.sizes}
        sample={(value) => ({ fontSize: value, lineHeight: 1.2 })}
      />
      <SampleSection
        title={t("weights")}
        tokens={type.weights}
        sample={(value) => ({ fontWeight: value, fontSize: "20px" })}
      />
      <SampleSection
        title={t("lineHeights")}
        tokens={type.lineHeights}
        sample={(value) => ({ lineHeight: value, fontSize: "14px" })}
        lines={2}
      />
      <SampleSection
        title={t("letterSpacing")}
        tokens={type.letterSpacing}
        sample={(value) => ({ letterSpacing: value, fontSize: "18px" })}
      />
      <BorderSection title={t("border")} tokens={tokens.border} />

      {system.rules.length > 0 ? (
        <section>
          <SectionTitle>{t("rules")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {system.rules.map((rule) => (
              <li key={rule.id} className="flex gap-3 rounded-lg border border-line p-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-faint">
                  {rule.severity === "must" ? t("must") : t("should")}
                </span>
                <span>{rule.statement}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

function ColorSection({
  title,
  tokens,
}: {
  title: string;
  tokens: DesignSystem["tokens"]["color"];
}) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([name, token]) => (
          <div key={name} className="min-w-0 overflow-hidden rounded-lg border border-line">
            <div className="h-24 w-full border-b border-line" style={{ background: token.value }} />
            <div className="p-3">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="ltr-content truncate font-mono text-xs text-faint">
                {token.value}
              </div>
              {token.usage ? (
                <div className="mt-1.5 line-clamp-3 text-xs text-muted">{token.usage}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Spacing bars are drawn relative to the largest step, not at their literal
 * width — otherwise a 4px step is a speck next to a 96px one and the shape of
 * the scale, which is the whole point, is invisible.
 */
function SpacingSection({ title, tokens }: { title: string; tokens: Record<string, DimensionToken> }) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, token]) => toPx(token.value) ?? 0), 1);

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="divide-y divide-line rounded-lg border border-line">
        {entries.map(([name, token]) => {
          const px = toPx(token.value);
          return (
            <div key={name} className="flex items-center gap-4 px-4 py-3">
              <Label name={name} value={token.value} />
              <span className="flex min-w-0 flex-1 items-center">
                <span
                  className="h-3 rounded-sm bg-ink"
                  style={{ width: `${Math.max(((px ?? 0) / max) * 100, 1.5)}%` }}
                />
              </span>
              <Usage text={token.usage} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RadiusSection({ title, tokens }: { title: string; tokens: Record<string, DimensionToken> }) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {entries.map(([name, token]) => (
          <div key={name} className="min-w-0 rounded-lg border border-line p-3">
            <div className="flex h-20 items-center justify-center">
              <div
                className="h-16 w-full border-2 border-ink bg-raised"
                style={{ borderRadius: token.value }}
              />
            </div>
            <div className="mt-2 truncate text-sm">{name}</div>
            <div className="ltr-content truncate font-mono text-xs text-faint">{token.value}</div>
            {token.usage ? (
              <div className="mt-1 line-clamp-2 text-xs text-muted">{token.usage}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The luminance of a shadow's own colour, or null when we cannot read one.
 *
 * A shadow is only visible against a surface it can change. A near-black
 * shadow needs a light stage; a glow needs a dark one. Guessing wrong makes
 * the swatch look empty, which is exactly the bug this replaces.
 */
function shadowLuminance(value: string): number | null {
  const rgba = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  if (/\b(white|#fff)\b/i.test(value)) return 1;
  return null;
}

function ShadowSection({ title, tokens }: { title: string; tokens: Record<string, DimensionToken> }) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([name, token]) => {
          // Dark shadow on a light stage, glow on a dark one. These stages are
          // deliberately fixed rather than themed: the point of the swatch is
          // to show the shadow, and the viewer's colour scheme has no say in
          // whether a black blur is visible.
          const glow = (shadowLuminance(token.value) ?? 0) > 0.6;
          const stage = glow ? "#101114" : "#eceded";
          const card = glow ? "#1b1d22" : "#ffffff";
          const ink = glow ? "#c9ccd1" : "#5b6068";

          return (
            <div key={name} className="flex min-w-0 flex-col gap-2">
              {/* The padding is not decoration: a shadow needs room around the
                  card or it is clipped and reads as flat. */}
              <div
                className="flex items-center justify-center rounded-lg border border-line p-6"
                style={{ background: stage }}
              >
                <div
                  className="flex h-20 w-full items-center justify-center rounded-lg text-sm"
                  style={{ background: card, boxShadow: token.value, color: ink }}
                >
                  {name}
                </div>
              </div>
              {/* Wrapped, not truncated: a two-part shadow is exactly the
                  value worth reading, and a phone has no hover to reveal a
                  title attribute. */}
              <div className="ltr-content font-mono text-xs break-all text-faint">
                {token.value}
              </div>
              {token.usage ? <div className="text-xs text-muted">{token.usage}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BorderSection({ title, tokens }: { title: string; tokens: Record<string, DimensionToken> }) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="divide-y divide-line rounded-lg border border-line">
        {entries.map(([name, token]) => (
          <div key={name} className="flex items-center gap-4 px-4 py-3">
            <Label name={name} value={token.value} />
            <span className="min-w-0 flex-1">
              <span
                className="block h-8 rounded-md border-ink"
                style={{ borderWidth: token.value, borderStyle: "solid" }}
              />
            </span>
            <Usage text={token.usage} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Type tokens, set in themselves.
 *
 * The sample is deliberately two short words, one per script: a sentence gets
 * truncated on a phone, and a truncated sample demonstrates nothing — least of
 * all a line height, which needs two lines to be visible at all.
 */
const TYPE_SAMPLE = "Aa أبجد";

function SampleSection({
  title,
  tokens,
  sample,
  lines = 1,
}: {
  title: string;
  tokens: Record<string, DimensionToken>;
  sample: (value: string) => React.CSSProperties;
  lines?: number;
}) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="divide-y divide-line rounded-lg border border-line">
        {entries.map(([name, token]) => (
          <div key={name} className="flex items-center gap-4 px-4 py-3">
            <Label name={name} value={token.value} />
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block" style={sample(token.value)}>
                {lines > 1 ? (
                  <>
                    {TYPE_SAMPLE}
                    <br />
                    {TYPE_SAMPLE}
                  </>
                ) : (
                  TYPE_SAMPLE
                )}
              </span>
            </span>
            <Usage text={token.usage} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Components, drawn state by state.
 *
 * `preview.states` is optional, so a system extracted before previews existed
 * still renders — it just falls back to the variant chips it always had.
 */
function ComponentSection({
  title,
  components,
  t,
}: {
  title: string;
  components: DesignSystem["components"];
  t: (key: string) => string;
}) {
  if (components.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        {components.map((component) => {
          const preview = safePreview(component.preview);
          return (
            <div key={component.name} className="flex min-w-0 flex-col rounded-lg border border-line">
              {preview ? (
                <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line bg-raised p-5">
                  {preview.states.map((state) => (
                    <div key={state.name} className="flex flex-col items-start gap-1.5">
                      <PreviewBox
                        element={preview.element}
                        styles={state.styles}
                        label={preview.label ?? component.name}
                      />
                      <span className="font-mono text-[11px] text-faint">{state.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="p-4">
                <div className="font-medium">{component.name}</div>
                {component.description ? (
                  <p className="mt-1 text-sm text-muted">{component.description}</p>
                ) : null}
                {!preview && component.variants.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {component.variants.map((variant) => (
                      <span
                        key={variant}
                        className="rounded border border-line px-1.5 py-0.5 font-mono text-xs text-muted"
                      >
                        {variant}
                      </span>
                    ))}
                  </div>
                ) : null}
                {component.dos.length + component.donts.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1 text-sm">
                    {component.dos.map((item) => (
                      <li key={item} className="text-muted">
                        <span className="text-pass">✓</span> {item}
                      </li>
                    ))}
                    {component.donts.map((item) => (
                      <li key={item} className="text-muted">
                        <span className="text-fail">✕</span> {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {component.tokensUsed.length > 0 ? (
                  <p className="ltr-content mt-3 truncate font-mono text-xs text-faint">
                    {component.tokensUsed.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The sample itself. Styles arrive sanitised from core; the element only
 * decides what shape the sample takes and what fills it, never how it looks.
 */
function PreviewBox({
  element,
  styles,
  label,
}: {
  element: PreviewElement;
  styles: Record<string, string>;
  label: string;
}) {
  const base: React.CSSProperties = { display: "inline-flex", ...(styles as React.CSSProperties) };

  switch (element) {
    case "input":
      return (
        <span style={{ ...base, alignItems: "center", minWidth: "10rem" }} className="text-sm">
          {label}
        </span>
      );
    case "card":
    case "surface":
      return <span style={{ ...base, minWidth: "12rem", minHeight: "4rem" }} className="block" />;
    case "text":
      return <span style={styles as React.CSSProperties}>{label}</span>;
    case "badge":
    case "button":
    default:
      return (
        <span
          style={{ ...base, alignItems: "center", justifyContent: "center" }}
          className="text-sm"
        >
          {label}
        </span>
      );
  }
}

/* ----------------------------------------------------------------- shared */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium text-muted">{children}</h2>;
}

function Label({ name, value }: { name: string; value: string }) {
  return (
    <span className="flex w-24 shrink-0 flex-col sm:w-40">
      <span className="truncate text-sm">{name}</span>
      <span className="ltr-content truncate font-mono text-xs text-faint">{value}</span>
    </span>
  );
}

function Usage({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="hidden w-48 shrink-0 truncate text-xs text-muted sm:block">{text}</span>;
}
