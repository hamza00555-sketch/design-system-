import { defineRouting } from "next-intl/routing";

/**
 * Arabic and English are both first-class: neither is a translation layer over
 * the other, so both carry a locale prefix and the same route tree.
 */
export const routing = defineRouting({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const direction: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};
