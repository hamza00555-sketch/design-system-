import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Cards, Section, SiteShell, Steps } from "@/components/SiteShell";
import { Link } from "@/i18n/navigation";

export default async function StoragePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <SiteShell>
      <Storage />
    </SiteShell>
  );
}

function Storage() {
  const t = useTranslations("site");
  return (
    <>
      <section className="flex flex-col gap-6 py-16">
        <p className="font-mono text-xs text-faint">{t("useCases.storageEyebrow")}</p>
        <h1 className="max-w-3xl text-3xl leading-tight font-medium tracking-tight">
          {t("useCases.storageTitle")}
        </h1>
        <p className="max-w-2xl text-muted">{t("useCases.storageBody")}</p>
      </section>

      <Section title={t("useCases.todayTitle")}>
        <Cards
          items={[
            { title: t("useCases.today1Title"), body: t("useCases.today1Body") },
            { title: t("useCases.today2Title"), body: t("useCases.today2Body") },
            { title: t("useCases.today3Title"), body: t("useCases.today3Body") },
          ]}
        />
      </Section>

      <Section title={t("useCases.liveTitle")}>
        <Steps
          items={[
            {
              title: t("useCases.live1Title"),
              body: t("useCases.live1Body"),
              code: "extraction → 41 of 41 tokens · pushed",
            },
            {
              title: t("useCases.live2Title"),
              body: t("useCases.live2Body"),
              code: "v12 → v13 · restore anytime",
            },
            {
              title: t("useCases.live3Title"),
              body: t("useCases.live3Body"),
              code: "npx miswadah init",
            },
          ]}
        />
      </Section>

      <Section>
        <h2 className="text-xl font-medium tracking-tight">{t("useCases.storageClose")}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t("useCases.storageCloseBody")}</p>
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
