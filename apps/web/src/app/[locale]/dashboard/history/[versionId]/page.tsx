"use client";

import { countTokens } from "@miswadah/core";
import { useFormatter, useTranslations } from "next-intl";
import { use } from "react";
import { AppShell } from "@/components/AppShell";
import { TokenGrid } from "@/components/TokenGrid";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { useVersion } from "@/lib/data";
import { downloadDesignMd, downloadTokensJson } from "@/lib/download";

export default function VersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = use(params);
  return (
    <AppShell>
      <Version versionId={versionId} />
    </AppShell>
  );
}

function Version({ versionId }: { versionId: string }) {
  const t = useTranslations("history");
  const tDash = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { workspace, systemId } = useAuth();
  const version = useVersion(systemId, versionId);

  if (version.loading) return <p className="text-sm text-muted">{tCommon("loading")}</p>;
  if (!version.data) return <p className="text-sm text-muted">{t("empty")}</p>;

  const { system, n, createdAt } = version.data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/history" className="text-sm text-muted hover:text-ink">
          ← {t("backToHistory")}
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{t("versionTitle", { n })}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {system.meta.name}
            {" · "}
            {tDash("tokenCount", { count: countTokens(system) })}
            {createdAt
              ? ` · ${format.dateTime(new Date(createdAt), { dateStyle: "medium" })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadDesignMd(system)}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
          >
            {tDash("exportMd")}
          </button>
          <button
            type="button"
            onClick={() => downloadTokensJson(system)}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
          >
            {tDash("exportJson")}
          </button>
        </div>
      </header>

      <TokenGrid system={system} />
    </div>
  );
}
