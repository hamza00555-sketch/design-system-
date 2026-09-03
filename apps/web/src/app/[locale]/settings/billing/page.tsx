"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SettingsShell } from "@/components/SettingsShell";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BILLING_ENABLED } from "@/lib/billing";
import { useMembers, usePendingInvites, useProjects } from "@/lib/data";
import { db } from "@/lib/firebase";

/** Kept in step with functions/src/plans.ts. */
const FREE_LIMITS = { projects: 1, seats: 1 };

export default function BillingPage() {
  const t = useTranslations("settings");
  const { workspace } = useAuth();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const projects = useProjects(workspace?.teamId ?? null);
  const members = useMembers(workspace?.teamId ?? null);
  const invites = usePendingInvites(workspace?.teamId ?? null);

  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<{ cancelAtPeriodEnd: boolean; hasCustomer: boolean }>({
    cancelAtPeriodEnd: false,
    hasCustomer: false,
  });

  // The plan on the auth context is from sign-in; the team document is live, so
  // a Stripe webhook landing seconds after checkout updates this page itself.
  useEffect(() => {
    if (!workspace) return;
    return onSnapshot(doc(db(), "teams", workspace.teamId), (snap) => {
      setBilling({
        cancelAtPeriodEnd: Boolean(snap.get("cancelAtPeriodEnd")),
        hasCustomer: Boolean(snap.get("stripeCustomerId")),
      });
      setPlan(snap.get("plan") === "pro" ? "pro" : "free");
    });
  }, [workspace]);

  const [plan, setPlan] = useState<"free" | "pro">(workspace?.plan ?? "free");
  // With billing off nobody is on a lesser plan, so the whole page reads as
  // open rather than as a free tier waiting to be upgraded.
  const isPro = !BILLING_ENABLED || plan === "pro";

  const go = async (which: "checkout" | "portal") => {
    if (!workspace) return;
    setPending(which);
    setError(null);
    try {
      const { url } = await callApi<{ url: string }>(`/api/billing/${which}`, {
        teamId: workspace.teamId,
        locale,
      });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "not_configured"
          ? t("billingUnconfigured")
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setPending(null);
    }
  };

  const seatsUsed = members.data.length + invites.data.length;
  const limit = (value: number) => (isPro ? t("seatsUnlimited") : String(value));
  const planLine = !BILLING_ENABLED ? t("planOpen") : isPro ? t("planPro") : t("planFree");
  const planTag = !BILLING_ENABLED
    ? t("planLabelOpen")
    : isPro
      ? t("planLabelPro")
      : t("planLabelFree");

  return (
    <SettingsShell>
      <div className="flex max-w-lg flex-col gap-6">
        {BILLING_ENABLED ? (
          <Suspense fallback={null}>
            <CheckoutNotice />
          </Suspense>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">{t("plan")}</h2>
          <div className="rounded-lg border border-line">
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <span className="text-sm">{planLine}</span>
              <span className="font-mono text-xs text-faint">{planTag}</span>
            </div>
            <dl className="divide-y divide-line text-sm">
              <Row
                label={t("projectsUsed")}
                value={t("seatsUsed", {
                  used: projects.data.length,
                  limit: limit(FREE_LIMITS.projects),
                })}
              />
              <Row
                label={t("seats")}
                value={t("seatsUsed", { used: seatsUsed, limit: limit(FREE_LIMITS.seats) })}
              />
            </dl>
          </div>
          {BILLING_ENABLED && billing.cancelAtPeriodEnd ? (
            <p className="mt-2 text-xs text-muted">{t("cancelPending")}</p>
          ) : null}
          {!BILLING_ENABLED ? <p className="mt-2 text-xs text-muted">{t("openBody")}</p> : null}
        </section>

        <section className={BILLING_ENABLED ? "flex flex-col gap-2" : "hidden"}>
          {isPro || billing.hasCustomer ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => go("portal")}
              className="self-start rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
            >
              {pending === "portal" ? t("upgrading") : t("manage")}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => go("checkout")}
                className="self-start rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-raised disabled:opacity-50"
              >
                {pending === "checkout" ? t("upgrading") : t("upgrade")}
              </button>
              <p className="text-xs text-faint">{t("priceLine")}</p>
            </>
          )}
          {error ? <p className="text-sm text-fail">{error}</p> : null}
        </section>
      </div>
    </SettingsShell>
  );
}

/**
 * Stripe sends people back here with ?checkout=… . Reading search params opts a
 * page out of static rendering, so it lives behind its own Suspense boundary
 * and the rest of the page still prerenders.
 */
function CheckoutNotice() {
  const t = useTranslations("settings");
  const search = useSearchParams();
  const state = search?.get("checkout");
  if (state !== "done" && state !== "cancelled") return null;

  return (
    <p
      className={`rounded-lg border border-line bg-raised px-4 py-3 text-sm ${
        state === "done" ? "text-pass" : "text-muted"
      }`}
    >
      {state === "done" ? t("checkoutDone") : t("checkoutCancelled")}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="ltr-content font-mono text-xs">{value}</dd>
    </div>
  );
}
