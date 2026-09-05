"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettingsShell } from "@/components/SettingsShell";
import { callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMembers } from "@/lib/data";

export default function MembersPage() {
  return (
    <SettingsShell>
      <Members />
    </SettingsShell>
  );
}

/**
 * Who is on this team.
 *
 * Signing up is open, and each person who signs in gets their own team — so
 * nobody is added here. A team that gained members while invitations existed
 * can still shed one, which is why removal stays.
 */
function Members() {
  const t = useTranslations("settings");
  const { workspace } = useAuth();
  const members = useMembers(workspace?.teamId ?? null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (uid: string) => {
    try {
      await callApi("/api/members/remove", { teamId: workspace?.teamId, uid });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("membersTitle")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("membersBody")}</p>
      </header>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {members.data.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm">
              {member.name ?? member.email ?? member.uid}
            </span>
            <span className="text-xs text-faint">{roleLabel(member.role, t)}</span>
            {member.role !== "owner" ? (
              <button
                type="button"
                onClick={() => remove(member.uid)}
                className="rounded-md border border-line-strong px-2 py-1 text-xs text-muted transition hover:bg-raised hover:text-ink"
              >
                {t("remove")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-fail">{error}</p> : null}
    </div>
  );
}

function roleLabel(role: string, t: (key: string) => string): string {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("roleAdmin");
  return t("roleMember");
}
