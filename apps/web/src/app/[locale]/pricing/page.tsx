import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PricingCard } from "@/components/PricingCard";
import { Section, SiteShell } from "@/components/SiteShell";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <SiteShell>
      <Pricing />
    </SiteShell>
  );
}

function Pricing() {
  const t = useTranslations("site");
  return (
    <>
      <section className="py-16">
        <h1 className="max-w-2xl text-3xl leading-tight font-medium tracking-tight">
          {t("pricing.title")}
        </h1>
        <div className="mt-8 max-w-xl">
          <PricingCard />
        </div>
      </section>
      <Section title={t("faq.title")}>
        <dl className="flex flex-col divide-y divide-line border-y border-line">
          {[1, 2, 5].map((n) => (
            <div key={n} className="flex flex-col gap-2 py-5">
              <dt className="font-medium">{t(`faq.q${n}` as "faq.q1")}</dt>
              <dd className="text-sm text-muted">{t(`faq.a${n}` as "faq.a1")}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
