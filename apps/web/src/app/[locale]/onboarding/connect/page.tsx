"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Link } from "@/i18n/navigation";
import { Copyable } from "@/components/Copyable";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ConnectPage() {
  return (
    <OnboardingShell step={2}>
      <Connect />
    </OnboardingShell>
  );
}

interface Minted {
  code: string;
  expiresAt: number;
}

function Connect() {
  const t = useTranslations("connect");
  const tOnboarding = useTranslations("onboarding");
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
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("body")}</p>
      </header>

      {error ? <p className="text-sm text-fail">{error}</p> : null}

      {!minted ? (
        <p className="text-sm text-muted">{t("minting")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Copyable value={`npx miswadah init --code ${minted.code}`} />
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

      <Link
        href="/onboarding/prompt"
        className="self-start rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
      >
        {tOnboarding("next")}
      </Link>
    </div>
  );
}
