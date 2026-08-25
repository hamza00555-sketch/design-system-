import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Cards, Receipt, Section, SiteShell } from "@/components/SiteShell";
import { Link } from "@/i18n/navigation";

export default async function DesignReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <SiteShell>
      <Review />
    </SiteShell>
  );
}

function Review() {
  const t = useTranslations("site");
  return (
    <>
      <section className="flex flex-col gap-6 py-16">
        <p className="font-mono text-xs text-faint">{t("useCases.reviewEyebrow")}</p>
        <h1 className="max-w-3xl text-3xl leading-tight font-medium tracking-tight">
          {t("useCases.reviewTitle")}
        </h1>
        <p className="max-w-2xl text-muted">{t("useCases.reviewBody")}</p>
        <Receipt
          label={t("hero.receiptLabel")}
          line={[
            "#3D7BF2 — off-brand · use color.primary",
            "14px gap — off-grid · use spacing.md",
            "fixed → re-verified · 0 off-brand values",
          ].join("\n")}
        />
      </section>

      <Section title={t("useCases.driftTitle")}>
        <Cards
          items={[
            { title: t("useCases.drift1Title"), body: t("useCases.drift1Body") },
            { title: t("useCases.drift2Title"), body: t("useCases.drift2Body") },
            { title: t("useCases.drift3Title"), body: t("useCases.drift3Body") },
          ]}
        />
      </Section>

      <Section>
        <h2 className="text-xl font-medium tracking-tight">{t("useCases.reviewClose")}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t("useCases.reviewCloseBody")}</p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
        >
          {t("hero.cta")}
        </Link>
      </Section>
    </>
  );
}
