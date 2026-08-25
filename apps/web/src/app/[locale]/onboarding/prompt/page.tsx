"use client";

import { countTokens } from "@tokenwell/core";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Copyable } from "@/components/Copyable";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { useSystem, useVersion } from "@/lib/data";

const EXTRACT_PROMPT = `Read this repository's shipped styling and extract its real design system: the colours, type, spacing, radii, and the usage rules the code already follows. Name tokens for their role, not their appearance — primary, ink, muted, surface, never blue600. Collapse near-duplicate values into one token. Keep the scales small and even. Then call the \`push_design_system\` tool on the \`tokenwell\` MCP server with the result.`;

export default function PromptPage() {
  const t = useTranslations("onboarding");
  const { workspace } = useAuth();
  const router = useRouter();

  const system = useSystem(workspace?.systemId ?? null);
  const current = useVersion(workspace?.systemId ?? null, system.data?.currentVersionId ?? null);

  // This page is a live wait, not a form: the moment the agent pushes, the
  // Firestore listener fires and we move on without anyone clicking anything.
  useEffect(() => {
    if (!current.data) return undefined;
    const timer = setTimeout(() => router.replace("/onboarding/result"), 1400);
    return () => clearTimeout(timer);
  }, [current.data, router]);

  return (
    <OnboardingShell step={3}>
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("promptTitle")}</h1>
        <p className="text-sm text-muted">{t("promptBody")}</p>
      </header>

      <Copyable value={EXTRACT_PROMPT} />

      <p className={`text-sm ${current.data ? "text-pass" : "text-muted"}`}>
        {current.data
          ? t("promptArrived", { count: countTokens(current.data.system) })
          : t("promptWaiting")}
      </p>

      <Link href="/onboarding/connect" className="self-start text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
    </OnboardingShell>
  );
}
