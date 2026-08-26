"use client";

import { countTokens } from "@tokenwell/core";
import { useTranslations } from "next-intl";
import { OnboardingShell } from "@/components/OnboardingShell";
import { TokenGrid } from "@/components/TokenGrid";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { BILLING_ENABLED } from "@/lib/billing";
import { useSystem, useVersion } from "@/lib/data";

export default function ResultPage() {
  const t = useTranslations("onboarding");
  const tDash = useTranslations("dashboard");
  const { workspace } = useAuth();
  const system = useSystem(workspace?.systemId ?? null);
  const current = useVersion(workspace?.systemId ?? null, system.data?.currentVersionId ?? null);

  return (
    <OnboardingShell step={4}>
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("resultTitle")}</h1>
        <p className="text-sm text-muted">{t("resultBody")}</p>
        {current.data ? (
          <p className="text-sm text-muted">
            {current.data.system.meta.name}
            {" · "}
            {tDash("tokenCount", { count: countTokens(current.data.system) })}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
        >
          {t("resultCta")}
        </Link>
        {BILLING_ENABLED ? (
          <Link
            href="/onboarding/upgrade"
            className="rounded-md px-4 py-2 text-sm text-muted transition hover:bg-raised hover:text-ink"
          >
            {t("next")}
          </Link>
        ) : null}
      </div>

      {current.data ? <TokenGrid system={current.data.system} /> : null}
    </OnboardingShell>
  );
}
