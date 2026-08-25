"use client";

import { useTranslations } from "next-intl";
import { SettingsShell } from "@/components/SettingsShell";
import { useAuth } from "@/lib/auth";

export default function MembersPage() {
  const t = useTranslations("settings");
  const { user, workspace } = useAuth();

  return (
    <SettingsShell>
      <div className="flex max-w-lg flex-col gap-3">
        <div className="divide-y divide-line rounded-lg border border-line">
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1 truncate">{user?.email ?? user?.displayName ?? "—"}</span>
            <span className="font-mono text-xs text-faint">{workspace?.role ?? ""}</span>
          </div>
        </div>
        <p className="text-xs text-faint">{t("comingSoon")}</p>
      </div>
    </SettingsShell>
  );
}
