"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/i18n/navigation";
import { callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjects, useTeamSystems } from "@/lib/data";

export default function SystemsPage() {
  return (
    <AppShell>
      <Systems />
    </AppShell>
  );
}

/**
 * A team's design systems — one per product.
 *
 * This is also the switcher: the rest of the app reads whichever system is
 * active here, so a second product means a second system, not a second account.
 */
function Systems() {
  const t = useTranslations("systems");
  const tCommon = useTranslations("common");
  const { workspace, systemId, setSystemId } = useAuth();

  const systems = useTeamSystems(workspace?.teamId ?? null);
  const projects = useProjects(workspace?.teamId ?? null);

  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const created = await callApi<{ systemId: string }>("/api/systems/create", {
        teamId: workspace.teamId,
        name: name.trim(),
      });
      // Switch to it straight away: you made it because you want to fill it.
      setSystemId(created.systemId);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  if (systems.loading) return <p className="text-sm text-muted">{tCommon("loading")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>
      </header>

      <ul className="flex flex-col gap-2">
        {systems.data.map((system) => {
          const active = system.id === systemId;
          const count = projects.data.filter((project) => project.systemId === system.id).length;
          return (
            <li
              key={system.id}
              className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-4 ${
                active ? "border-ink" : "border-line"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{system.name}</span>
                  {active ? (
                    <span className="text-xs text-muted">{t("active")}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {system.versionCount > 0
                    ? t("versions", { count: system.versionCount })
                    : t("empty")}
                  {" · "}
                  {t("projects", { count })}
                </p>
              </div>

              {active ? (
                <Link
                  href="/dashboard"
                  className="rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-raised"
                >
                  {t("open")}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setSystemId(system.id)}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
                >
                  {t("use")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-t border-line pt-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-faint">{t("newLabel")}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("newPlaceholder")}
            className="min-w-56 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-raised disabled:opacity-50"
        >
          {pending ? t("creating") : t("create")}
        </button>
      </form>

      {error ? <p className="text-sm text-fail">{error}</p> : null}
    </div>
  );
}
