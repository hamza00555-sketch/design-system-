"use client";

import { useTranslations } from "next-intl";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Link } from "@/i18n/navigation";

export default function UpgradePage() {
  const t = useTranslations("onboarding");

  return (
    <OnboardingShell step={4}>
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("upgradeTitle")}</h1>
        <p className="text-sm text-muted">{t("upgradeBody")}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings/billing"
          className="rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
        >
          {t("upgradeCta")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md px-4 py-2 text-sm text-muted transition hover:bg-raised hover:text-ink"
        >
          {t("upgradeSkip")}
        </Link>
      </div>
    </OnboardingShell>
  );
}
