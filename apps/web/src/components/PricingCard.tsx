import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BILLING_ENABLED } from "@/lib/billing";

export function PricingCard() {
  const t = useTranslations("site.pricing");

  // Nothing is for sale while billing is off, so the page says that plainly
  // rather than advertising a price no one can pay.
  if (!BILLING_ENABLED) {
    return (
      <div className="rounded-lg border border-line p-6">
        <h3 className="text-lg font-medium tracking-tight">{t("openTitle")}</h3>
        <p className="mt-2 max-w-xl text-sm text-muted">{t("openBody")}</p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
        >
          {t("openCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line p-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="font-medium">{t("planName")}</h3>
          <span className="flex-1" />
          <span className="text-faint line-through">{t("priceWas")}</span>
          <span className="text-2xl font-medium tracking-tight">{t("price")}</span>
          <span className="text-sm text-muted">{t("per")}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{t("founding")}</p>

        <ul className="mt-6 flex flex-col gap-2 text-sm">
          {["f1", "f2", "f3", "f4", "f5"].map((key) => (
            <li key={key} className="flex gap-2 text-muted">
              <span aria-hidden className="text-faint">
                —
              </span>
              {t(key as "f1")}
            </li>
          ))}
        </ul>

        <Link
          href="/sign-in"
          className="mt-6 inline-block rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-raised"
        >
          {t("cta")}
        </Link>
      </div>
      <p className="text-sm text-faint">{t("free")}</p>
    </div>
  );
}
