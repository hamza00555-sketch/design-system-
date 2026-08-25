"use client";

import { useTranslations } from "next-intl";
import { SettingsShell } from "@/components/SettingsShell";
import { useAuth } from "@/lib/auth";

export default function BillingPage() {
  const t = useTranslations("settings");
  const { workspace } = useAuth();

  return (
    <SettingsShell>
      <div className="flex max-w-lg flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t("plan")}</h2>
        <div className="rounded-lg border border-line px-4 py-3 text-sm">
          {workspace?.plan === "pro" ? t("planPro") : t("planFree")}
        </div>
        <p className="text-xs text-faint">{t("comingSoon")}</p>
      </div>
    </SettingsShell>
  );
}
