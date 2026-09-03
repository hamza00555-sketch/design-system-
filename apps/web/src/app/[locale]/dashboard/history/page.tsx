"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/i18n/navigation";
import { callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSystem, useVersions } from "@/lib/data";

export default function HistoryPage() {
  return (
    <AppShell>
      <History />
    </AppShell>
  );
}

function History() {
  const t = useTranslations("history");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { workspace } = useAuth();
  const system = useSystem(workspace?.systemId ?? null);
  const versions = useVersions(workspace?.systemId ?? null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restore = async (versionId: string) => {
    // Unreachable: AppShell does not render children without a workspace.
    if (!workspace) return;
    setRestoring(versionId);
    setError(null);
    try {
      await callApi("/api/versions/restore", {
        teamId: workspace.teamId,
        systemId: workspace.systemId,
        versionId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>
      </header>

      {error ? <p className="text-sm text-fail">{error}</p> : null}

      {versions.loading ? (
        <p className="text-sm text-muted">{tCommon("loading")}</p>
      ) : versions.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {versions.data.map((version) => {
            const isCurrent = version.id === system.data?.currentVersionId;
            return (
              <li key={version.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Link
                  href={`/dashboard/history/${version.id}`}
                  className="ltr-content font-mono text-sm hover:underline"
                >
                  v{version.n}
                </Link>
                <span className="flex-1 truncate text-sm text-muted">
                  <span className="ltr-content font-mono text-xs">{version.summary}</span>
                  {" · "}
                  {t("source", { source: version.source })}
                </span>
                {version.createdAt ? (
                  <time className="text-xs text-faint">
                    {format.dateTime(new Date(version.createdAt), { dateStyle: "medium" })}
                  </time>
                ) : null}
                {isCurrent ? (
                  <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">
                    {t("current")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={restoring !== null}
                    onClick={() => restore(version.id)}
                    className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
                  >
                    {restoring === version.id ? t("restoring") : t("restore")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
