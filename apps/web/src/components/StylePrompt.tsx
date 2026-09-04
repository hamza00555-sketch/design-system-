"use client";

import { toStylePrompt, type DesignSystem } from "@miswadah/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { downloadStylePrompt } from "@/lib/download";

/**
 * The system as a portable prompt.
 *
 * Exports answer "how do I take my tokens elsewhere". This answers a different
 * question: how do I get the *same look* out of an agent that has never heard
 * of this product — a fresh chat, someone else's editor, a one-off script. So
 * it is one block of text carrying every value and every rule, written to be
 * pasted and nothing else.
 */
export function StylePrompt({ system }: { system: DesignSystem }) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => toStylePrompt(system), [system]);

  return (
    <section className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">{t("stylePrompt")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("stylePromptBody")}</p>
        </div>
        <div className="flex gap-2">
          <SmallButton
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? t("copied") : t("copyPrompt")}
          </SmallButton>
          <SmallButton onClick={() => downloadStylePrompt(system)}>{t("download")}</SmallButton>
          <SmallButton onClick={() => setOpen((value) => !value)}>
            {open ? t("hide") : t("preview")}
          </SmallButton>
        </div>
      </div>

      {open ? (
        <pre className="ltr-content max-h-96 overflow-auto border-t border-line bg-raised px-4 py-3 font-mono text-xs whitespace-pre-wrap">
          {prompt}
        </pre>
      ) : null}
    </section>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
