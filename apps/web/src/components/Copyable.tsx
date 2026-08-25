"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * A command you are meant to run. Always rendered LTR — a shell command reads
 * left-to-right whatever language surrounds it.
 */
export function Copyable({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("connect");
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-raised">
      {label ? (
        <div className="border-b border-line px-4 py-2 text-xs text-faint">{label}</div>
      ) : null}
      <div className="flex items-center gap-3 px-4 py-3">
        <code className="ltr-content flex-1 overflow-x-auto font-mono text-sm whitespace-pre">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="shrink-0 rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:bg-surface hover:text-ink"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}
