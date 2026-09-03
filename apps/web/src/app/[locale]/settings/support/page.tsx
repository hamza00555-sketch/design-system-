"use client";

import { useTranslations } from "next-intl";
import { SettingsShell } from "@/components/SettingsShell";

export default function SupportPage() {
  const t = useTranslations("settings");

  return (
    <SettingsShell>
      <div className="flex max-w-lg flex-col gap-3 text-sm text-muted">
        <p>{t("supportBody")}</p>
        <a className="ltr-content font-mono text-ink hover:underline" href="mailto:support@miswadah.design">
          support@miswadah.design
        </a>
      </div>
    </SettingsShell>
  );
}
