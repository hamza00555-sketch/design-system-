"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * One button, not a dropdown: with exactly two locales, a menu is a click of
 * ceremony around a single choice. The label is always the *other* language,
 * written in that language.
 */
export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();

  const current = params.locale as string;
  const next = routing.locales.find((locale) => locale !== current) ?? routing.defaultLocale;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          router.replace({ pathname }, { locale: next });
        })
      }
      className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
    >
      {t("language")}
    </button>
  );
}
