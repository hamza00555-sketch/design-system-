"use client";

import { countTokens } from "@miswadah/core";
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/AppShell";
import { ScreenGallery } from "@/components/ScreenGallery";
import { StylePrompt } from "@/components/StylePrompt";
import { TokenGrid } from "@/components/TokenGrid";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { useVerifications, useVersion, useSystem } from "@/lib/data";
import { downloadDesignMd, downloadTokensJson } from "@/lib/download";

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { workspace, user } = useAuth();

  const system = useSystem(workspace?.systemId ?? null);
  const current = useVersion(workspace?.systemId ?? null, system.data?.currentVersionId ?? null);
  const checks = useVerifications(workspace?.systemId ?? null);

  if (system.loading || current.loading) {
    return <p className="text-sm text-muted">{tCommon("loading")}</p>;
  }
  if (!current.data) return <EmptyState />;

  const version = current.data;
  const firstName = user?.displayName?.split(" ")[0];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {t("greeting")}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">{version.system.meta.name}</h1>
          <p className="mt-1.5 text-sm text-muted">
            <span className="ltr-content font-mono text-xs">{t("version", { n: version.n })}</span>
            {" · "}
            {t("tokenCount", { count: countTokens(version.system) })}
            {version.createdAt
              ? ` · ${t("updated", {
                  date: format.dateTime(new Date(version.createdAt), {
                    dateStyle: "medium",
                  }),
                })}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadDesignMd(version.system)}>{t("exportMd")}</Button>
          <Button onClick={() => downloadTokensJson(version.system)}>{t("exportJson")}</Button>
          <LinkButton href="/dashboard/history">{t("viewHistory")}</LinkButton>
          <LinkButton href="/onboarding/connect">{t("connectProject")}</LinkButton>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">{t("recentChecks")}</h2>
        {checks.data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
            {t("noChecks")}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {checks.data.map((check) => (
              <li key={check.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                <span
                  className={`font-mono text-xs ${check.passed ? "text-pass" : "text-fail"}`}
                >
                  {check.passed
                    ? t("checkPassed")
                    : t("checkFailed", { count: check.violationCount })}
                </span>
                <span className="flex-1 truncate text-xs text-faint">{check.projectId}</span>
                {check.createdAt ? (
                  <time className="text-xs text-faint">
                    {format.relativeTime(check.createdAt)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <StylePrompt system={version.system} />

      <ScreenGallery systemId={workspace?.systemId ?? null} />

      <TokenGrid system={version.system} />
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("empty");
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-5 py-16">
      <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      <ol className="flex flex-col gap-2 text-sm text-muted">
        {[t("step1"), t("step2"), t("step3")].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="font-mono text-xs text-faint">0{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <LinkButton href="/onboarding/extract">{t("cta")}</LinkButton>
    </div>
  );
}

function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
    >
      {children}
    </Link>
  );
}
