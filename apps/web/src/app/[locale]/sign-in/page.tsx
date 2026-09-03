"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

export default function SignInPage() {
  const t = useTranslations("auth");
  const { user, configured, error, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <div className="mb-8 font-mono text-sm tracking-tight">miswadah</div>
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!configured}
          onClick={() => signIn("google")}
          className="rounded-lg border border-line-strong px-4 py-2.5 text-sm transition hover:bg-raised disabled:opacity-50"
        >
          {t("google")}
        </button>
        <button
          type="button"
          disabled={!configured}
          onClick={() => signIn("github")}
          className="rounded-lg border border-line-strong px-4 py-2.5 text-sm transition hover:bg-raised disabled:opacity-50"
        >
          {t("github")}
        </button>
      </div>

      <p className="text-xs text-faint">{t("note")}</p>
      {!configured ? (
        <p className="text-xs text-fail">
          Firebase is not configured. Copy <code className="font-mono">apps/web/.env.example</code>{" "}
          to <code className="font-mono">.env.local</code>, fill it in, and restart the dev server.
        </p>
      ) : null}
      {error ? <p className="text-xs text-fail">{error}</p> : null}
    </div>
  );
}
