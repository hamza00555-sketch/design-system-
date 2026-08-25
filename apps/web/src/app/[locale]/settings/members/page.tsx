"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Copyable } from "@/components/Copyable";
import { SettingsShell } from "@/components/SettingsShell";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMembers, usePendingInvites } from "@/lib/data";

export default function MembersPage() {
  const t = useTranslations("settings");
  const { user, workspace } = useAuth();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  const members = useMembers(workspace?.teamId ?? null);
  const invites = usePendingInvites(workspace?.teamId ?? null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    setPending(true);
    setError(null);
    setLink(null);
    try {
      const result = await callApi<{ token: string }>("/api/members/invite", {
        teamId: workspace.teamId,
        email,
        role,
      });
      // The link is shown rather than emailed: this deployment has no mail
      // sender yet, and a link you can hand over beats an invitation that
      // silently never arrives.
      setLink(`${window.location.origin}/${locale}/invite/${result.token}`);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "upgrade_required"
          ? t("seatLimitReached")
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setPending(false);
    }
  };

  const act = async (path: string, body: Record<string, unknown>) => {
    if (!workspace) return;
    setError(null);
    try {
      await callApi(path, { teamId: workspace.teamId, ...body });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const roleLabel = (value: string) =>
    value === "owner" ? t("roleOwner") : value === "admin" ? t("roleAdmin") : t("roleMember");

  return (
    <SettingsShell>
      <div className="flex max-w-xl flex-col gap-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">{t("membersTitle")}</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {members.data.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 truncate">
                  {member.name ?? member.email ?? member.uid}
                  {member.uid === user?.uid ? <span className="text-faint"> ·</span> : null}
                </span>
                <span className="text-xs text-faint">{roleLabel(member.role)}</span>
                {canManage && member.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => act("/api/members/remove", { uid: member.uid })}
                    className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted transition hover:bg-raised hover:text-ink"
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {canManage ? (
          <section>
            <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("invitePlaceholder")}
                className="ltr-content min-w-56 flex-1 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink"
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "member" | "admin")}
                className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm"
              >
                <option value="member">{t("roleMember")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </select>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
              >
                {pending ? t("inviting") : t("invite")}
              </button>
            </form>
            {error ? <p className="mt-2 text-sm text-fail">{error}</p> : null}
            {link ? (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm text-muted">{t("inviteSent")}</p>
                <Copyable value={link} label={t("inviteLink")} />
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">{t("invitesTitle")}</h2>
          {invites.data.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-4 text-sm text-muted">
              {t("noInvites")}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {invites.data.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="ltr-content flex-1 truncate">{invite.email}</span>
                  <span className="text-xs text-faint">{roleLabel(invite.role)}</span>
                  <span className="text-xs text-faint">{t("pending")}</span>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => act("/api/members/revoke", { inviteId: invite.id })}
                      className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted transition hover:bg-raised hover:text-ink"
                    >
                      {t("revoke")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SettingsShell>
  );
}
