"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/AppShell";
import { ScreenGallery } from "@/components/ScreenGallery";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

export default function ScreensPage() {
  return (
    <AppShell>
      <Screens />
    </AppShell>
  );
}

function Screens() {
  const t = useTranslations("tokens");
  const tDash = useTranslations("dashboard");
  const { systemId } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("screens")}</h1>
        <Link
          href="/dashboard"
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
        >
          {tDash("backToDashboard")}
        </Link>
      </header>

      <ScreenGallery systemId={systemId} />
    </div>
  );
}
