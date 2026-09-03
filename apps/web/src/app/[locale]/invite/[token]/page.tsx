"use client";

import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * The invitation link. Anyone holding the token can accept it, so it is spent
 * server-side in a transaction — this page only carries it across the sign-in.
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations("invite");
  const tAuth = useTranslations("auth");
  const { user, configured, signIn } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<"idle" | "joining" | "joined">("idle");
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  const accept = async () => {
    setState("joining");
    setError(null);
    try {
      const result = await callApi<{ teamName: string }>("/api/invites/accept", { token });
      setTeamName(result.teamName);
      setState("joined");
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (err) {
      setState("idle");
      if (err instanceof ApiError) {
        setError(
          err.code === "expired" ? t("expired") : err.code === "invalid_token" ? t("invalid") : err.message,
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  // Signing in is the only step that needs the person; once they are back,
  // accepting is automatic — nobody wants to click "accept" twice.
  useEffect(() => {
    if (user && state === "idle" && !error) void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <div className="mb-8 font-mono text-sm tracking-tight">miswadah</div>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("title", { team: teamName ?? "Miswadah" })}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("body")}</p>
      </div>

      {state === "joined" ? (
        <p className="text-sm text-pass">{t("accepted")}</p>
      ) : user ? (
        <button
          type="button"
          disabled={state === "joining"}
          onClick={accept}
          className="rounded-lg border border-line-strong px-4 py-2.5 text-sm transition hover:bg-raised disabled:opacity-50"
        >
          {state === "joining" ? t("accepting") : t("accept")}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">{t("signInFirst")}</p>
          <button
            type="button"
            disabled={!configured}
            onClick={() => signIn("google")}
            className="rounded-lg border border-line-strong px-4 py-2.5 text-sm transition hover:bg-raised disabled:opacity-50"
          >
            {tAuth("google")}
          </button>
          <button
            type="button"
            disabled={!configured}
            onClick={() => signIn("github")}
            className="rounded-lg border border-line-strong px-4 py-2.5 text-sm transition hover:bg-raised disabled:opacity-50"
          >
            {tAuth("github")}
          </button>
        </div>
      )}

      {error ? <p className="text-sm text-fail">{error}</p> : null}
    </div>
  );
}
