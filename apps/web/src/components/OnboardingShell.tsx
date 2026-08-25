"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { AppShell } from "./AppShell";

/**
 * Onboarding is four screens, and every one of them can be left. Somebody who
 * already knows the tool should be able to walk straight to the dashboard
 * rather than clicking through a tour of it.
 */
export function OnboardingShell({
  step,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const t = useTranslations("onboarding");

  return (
    <AppShell>
      <div className="flex max-w-2xl flex-col gap-8">
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-faint">{t("step", { n: step })}</span>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`h-0.5 flex-1 rounded ${n <= step ? "bg-ink" : "bg-line"}`}
              />
            ))}
          </div>
          <Link href="/dashboard" className="text-xs text-faint hover:text-ink">
            {t("skip")}
          </Link>
        </div>
        {children}
      </div>
    </AppShell>
  );
}
