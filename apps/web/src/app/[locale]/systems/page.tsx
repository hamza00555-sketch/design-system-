"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useProjects, useSystem, useVersion } from "@/lib/data";

export default function SystemsPage() {
  return (
    <AppShell>
      <Systems />
    </AppShell>
  );
}

function Systems() {
  const t = useTranslations("systems");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const format = useFormatter();
  const { workspace } = useAuth();

  const system = useSystem(workspace?.systemId ?? null);
  const current = useVersion(workspace?.systemId ?? null, system.data?.currentVersionId ?? null);
  const projects = useProjects(workspace?.teamId ?? null);

  if (system.loading) return <p className="text-sm text-muted">{tCommon("loading")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>
      </header>

      <div className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">{system.data?.name ?? "—"}</span>
          <span className="ltr-content font-mono text-xs text-faint">
            {current.data ? tDash("version", { n: current.data.n }) : "—"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{t("projects", { count: projects.data.length })}</p>
      </div>

      {projects.data.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {projects.data.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="text-sm">{project.name}</span>
              {project.repoName ? (
                <span className="ltr-content flex-1 truncate font-mono text-xs text-faint">
                  {project.repoName}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <span className="ltr-content font-mono text-xs text-faint">
                {project.keyPrefix}…
              </span>
              <span className="text-xs text-faint">
                {project.lastSeenAt
                  ? t("lastSeen", { date: format.relativeTime(project.lastSeenAt) })
                  : t("never")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
