"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/settings/billing", key: "billing" },
  { href: "/settings/members", key: "members" },
  { href: "/settings/support", key: "support" },
] as const;

export function SettingsShell({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");
  const pathname = usePathname();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <nav className="flex flex-wrap gap-1 border-b border-line pb-3">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-2.5 py-1 text-sm transition ${
                pathname === tab.href
                  ? "bg-raised text-ink"
                  : "text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {t(tab.key)}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
