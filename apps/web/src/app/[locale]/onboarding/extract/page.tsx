"use client";

import { useTranslations } from "next-intl";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Link } from "@/i18n/navigation";

export default function ExtractPage() {
  const t = useTranslations("onboarding");

  return (
    <OnboardingShell step={1}>
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("extractTitle")}</h1>
        <p className="text-sm text-muted">{t("extractBody")}</p>
      </header>

      <ol className="flex flex-col gap-3">
        {[t("extractStep1"), t("extractStep2"), t("extractStep3")].map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-muted">
            <span className="font-mono text-xs text-faint">0{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <Link
        href="/onboarding/connect"
        className="self-start rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
      >
        {t("next")}
      </Link>
    </OnboardingShell>
  );
}
