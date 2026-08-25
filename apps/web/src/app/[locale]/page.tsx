import { redirect } from "@/i18n/navigation";

/**
 * The marketing site lands here in a later phase. For now the root is a signed
 * -in product, so it goes straight to the dashboard (which sends you to
 * sign-in if you are not).
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/dashboard", locale });
}
