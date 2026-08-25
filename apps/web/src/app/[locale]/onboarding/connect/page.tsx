"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Copyable } from "@/components/Copyable";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EXTRACT_PROMPT = `Read this repository's shipped styling and extract its real design system: the colours, type, spacing, radii, and the usage rules the code already follows. Name tokens for their role, not their appearance. Collapse near-duplicate values into one token. Then call the \`push_design_system\` tool on the \`tokenwell\` MCP server with the result.`;

export default function ConnectPage() {
  return (
    <AppShell>
      <Connect />
    </AppShell>
  );
}

interface Minted {
  code: string;
  expiresAt: number;
}

function Connect() {
  const t = useTranslations("connect");
  const { workspace } = useAuth();
  const [minted, setMinted] = useState<Minted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const mint = useCallback(async () => {
    if (!workspace) return;
    setPending(true);
    setError(null);
    try {
      setMinted(
        await callApi<Minted>("/api/connect-codes", {
          teamId: workspace.teamId,
          systemId: workspace.systemId,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "upgrade_required"
          ? t("upgradeRequired")
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setPending(false);
    }
  }, [workspace, t]);

  useEffect(() => {
    if (workspace && !minted && !pending) void mint();
  }, [workspace, minted, pending, mint]);

  // The countdown is the point of the code: it says, plainly, use this now.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = minted ? Math.max(0, minted.expiresAt - now) : 0;
  const expired = Boolean(minted) && remaining === 0;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("body")}</p>
      </header>

      {error ? <p className="text-sm text-fail">{error}</p> : null}

      {!minted ? (
        <p className="text-sm text-muted">{t("minting")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Copyable value={`npx tokenwell init --code ${minted.code}`} />
          <div className="flex items-center gap-3 text-xs text-faint">
            <span>
              {expired
                ? t("expired")
                : t("expiresIn", {
                    minutes: Math.floor(remaining / 60000),
                    seconds: String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0"),
                  })}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={mint}
              className="rounded px-1.5 py-0.5 text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
            >
              {t("newCode")}
            </button>
          </div>
          <p className="text-xs text-faint">{t("cursorNote")}</p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">{t("afterTitle")}</h2>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li>{t("after1")}</li>
          <li>{t("after2")}</li>
          <li>{t("after3")}</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-muted">{t("promptTitle")}</h2>
        <p className="mb-3 text-sm text-muted">{t("promptBody")}</p>
        <Copyable value={EXTRACT_PROMPT} />
      </section>
    </div>
  );
}
