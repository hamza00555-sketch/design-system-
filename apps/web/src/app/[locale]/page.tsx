import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Cards, Receipt, Section, SiteShell, Steps } from "@/components/SiteShell";
import { Link, redirect } from "@/i18n/navigation";
import { PUBLIC_SITE } from "@/lib/site";
import { PricingCard } from "@/components/PricingCard";
import { BILLING_ENABLED } from "@/lib/billing";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // On a private instance the landing page is not what you want to see every
  // time you open the app.
  if (!PUBLIC_SITE) redirect({ href: "/dashboard", locale });
  return (
    <SiteShell>
      <Landing />
    </SiteShell>
  );
}

function Landing() {
  const t = useTranslations("site");

  return (
    <>
      <section className="flex flex-col gap-8 py-16">
        <div className="flex flex-col gap-5">
          <h1 className="max-w-3xl text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="max-w-2xl text-muted">{t("hero.body")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/sign-in"
              className="rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
            >
              {t("hero.cta")}
            </Link>
            <span className="text-sm text-faint">{t("hero.note")}</span>
          </div>
        </div>
        <Receipt
          label={t("hero.receiptLabel")}
          line={t("hero.receiptPass")}
          caption={t("hero.receiptCaption")}
        />
      </section>

      <Section title={t("how.title")}>
        <Steps
          items={[
            { title: t("how.step1Title"), body: t("how.step1Body"), code: t("how.step1Code") },
            { title: t("how.step2Title"), body: t("how.step2Body"), code: t("how.step2Code") },
            { title: t("how.step3Title"), body: t("how.step3Body"), code: t("how.step3Code") },
          ]}
        />
      </Section>

      <Section title={t("guarantee.title")}>
        <Cards
          items={[
            { title: t("guarantee.exportTitle"), body: t("guarantee.exportBody") },
            { title: t("guarantee.freeTitle"), body: t("guarantee.freeBody") },
            { title: t("guarantee.timeTitle"), body: t("guarantee.timeBody") },
          ]}
        />
      </Section>

      <Section title={BILLING_ENABLED ? t("pricing.title") : t("pricing.openTitle")}>
        <PricingCard />
      </Section>

      <Section title={t("faq.title")}>
        <dl className="flex flex-col divide-y divide-line border-y border-line">
          {[1, 2, 3, 4, 5].map((n) => (
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
