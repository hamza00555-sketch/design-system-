"use client";

import { toDesignMd, toW3CTokens, type DesignSystem } from "@tokenwell/core";

/**
 * Export runs in the browser: the version document already holds the whole
 * system, so there is nothing to ask the server for. That is also why export
 * can be promised on every plan without a rate limit behind it.
 */
export function downloadDesignMd(system: DesignSystem): void {
  save(`${slug(system.meta.name)}-DESIGN.md`, toDesignMd(system), "text/markdown");
}

export function downloadTokensJson(system: DesignSystem): void {
  save(
    `${slug(system.meta.name)}-tokens.json`,
    JSON.stringify(toW3CTokens(system), null, 2),
    "application/json",
  );
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design-system";
}

function save(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
