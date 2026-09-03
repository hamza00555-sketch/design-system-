"use client";

import type { DesignSystem, DimensionToken } from "@miswadah/core";
import { useTranslations } from "next-intl";

/**
 * The customer's tokens, shown as themselves — a colour swatch is the colour,
 * a spacing step is drawn at its own width. Values stay LTR: `#2f6bff` and
 * `16px` read the same way in every language.
 */
export function TokenGrid({ system }: { system: DesignSystem }) {
  const t = useTranslations("tokens");
  const { tokens } = system;
  const typography = tokens.typography;

  return (
    <div className="flex flex-col gap-10">
      {Object.keys(tokens.color).length > 0 ? (
        <section>
          <SectionTitle>{t("color")}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(tokens.color).map(([name, token]) => (
              <div key={name} className="rounded-lg border border-line p-3">
                <div
                  className="mb-3 h-12 w-full rounded-md border border-line"
                  style={{ background: token.value }}
                />
                <div className="truncate font-mono text-xs">{name}</div>
                <div className="ltr-content truncate font-mono text-xs text-faint">
                  {token.value}
                </div>
                {token.usage ? (
                  <div className="mt-1 line-clamp-2 text-xs text-muted">{token.usage}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ScaleSection title={t("spacing")} tokens={tokens.spacing} bar />
      <ScaleSection title={t("radius")} tokens={tokens.radius} />
      <ScaleSection title={t("sizes")} tokens={typography.sizes} />
      <ScaleSection title={t("weights")} tokens={typography.weights} />
      <ScaleSection title={t("families")} tokens={typography.families} />
      <ScaleSection title={t("lineHeights")} tokens={typography.lineHeights} />
      <ScaleSection title={t("letterSpacing")} tokens={typography.letterSpacing} />
      <ScaleSection title={t("shadow")} tokens={tokens.shadow} />
      <ScaleSection title={t("border")} tokens={tokens.border} />

      {system.components.length > 0 ? (
        <section>
          <SectionTitle>{t("components")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {system.components.map((component) => (
              <div key={component.name} className="rounded-lg border border-line p-4">
                <div className="font-medium">{component.name}</div>
                {component.description ? (
                  <p className="mt-1 text-sm text-muted">{component.description}</p>
                ) : null}
                {component.variants.length > 0 ? (
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
              </div>
            ))}
          </div>
        </section>
      ) : null}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium text-muted">{children}</h2>;
}

function ScaleSection({
  title,
  tokens,
  bar = false,
}: {
  title: string;
  tokens: Record<string, DimensionToken>;
  bar?: boolean;
}) {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="divide-y divide-line rounded-lg border border-line">
        {entries.map(([name, token]) => (
          <div key={name} className="flex items-center gap-4 px-4 py-2.5">
            <span className="w-28 shrink-0 truncate font-mono text-xs">{name}</span>
            <span className="ltr-content w-40 shrink-0 truncate font-mono text-xs text-faint">
              {token.value}
            </span>
            {bar ? (
              <span
                className="h-2 rounded-sm bg-line-strong"
                style={{ width: token.value, maxWidth: "100%" }}
              />
            ) : null}
            {token.usage ? (
              <span className="truncate text-xs text-muted">{token.usage}</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
