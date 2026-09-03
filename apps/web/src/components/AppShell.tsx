"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { LocaleSwitcher } from "./LocaleSwitcher";

const NAV = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/dashboard/history", key: "history" },
  { href: "/systems", key: "systems" },
  { href: "/settings/billing", key: "settings" },
] as const;

/**
 * The signed-in frame. It also owns the redirect to sign-in, so no page has to
 * repeat the guard — and none can forget it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { user, loading, configured, notAllowed, signOutNow } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/sign-in");
  }, [configured, loading, user, router]);

  if (!configured) return <NotConfigured />;
  if (loading) return <Centered>{tCommon("loading")}</Centered>;
  if (!user) return <Centered>{tAuth("required")}</Centered>;
  if (notAllowed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <p className="text-sm">{tAuth("notAllowed")}</p>
        <button
          type="button"
          onClick={signOutNow}
          className="self-start rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
        >
          {tAuth("signOutAndRetry")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-5">
        <Link href="/dashboard" className="font-mono text-sm tracking-tight">
          tokenwell
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1 text-sm transition ${
                  active ? "bg-raised text-ink" : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <LocaleSwitcher />
        <button
          type="button"
          onClick={signOutNow}
          className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-raised hover:text-ink"
        >
          {t("signOut")}
        </button>
      </header>
      <main className="flex-1 py-10">{children}</main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-sm text-muted">
      {children}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-lg font-medium">Firebase is not configured</h1>
      <p className="text-sm text-muted">
        Copy <code className="font-mono">apps/web/.env.example</code> to{" "}
        <code className="font-mono">.env.local</code> and fill in your Firebase web config and the
        Cloud Function base URL, then restart the dev server.
      </p>
    </div>
  );
}
