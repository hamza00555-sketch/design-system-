import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} document="privacy" />;
}
