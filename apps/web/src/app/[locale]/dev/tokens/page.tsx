"use client";

import type { DesignSystem } from "@miswadah/core";
import { clearGlass } from "@miswadah/core/fixtures/clearGlass";
import { TokenGrid } from "@/components/TokenGrid";

/**
 * Every token section rendered from a fixture, with no auth and no database.
 *
 * The dashboard needs a signed-in workspace and a pushed system, which makes
 * "does this look right on a phone, in the dark, in Arabic" an expensive
 * question to ask. Here it costs one URL.
 *
 * The shadows below are deliberately awkward: a two-part value long enough to
 * blow out a grid track, and a glow, which is invisible on the light stage a
 * drop shadow needs. Both were real bugs; keeping them here keeps them fixed.
 */
const preview: DesignSystem = {
  ...clearGlass,
  tokens: {
    ...clearGlass.tokens,
    shadow: {
      sm: { value: "0 1px 2px rgba(13, 17, 23, 0.06)", usage: "Resting cards" },
      md: { value: "0 4px 16px rgba(13, 17, 23, 0.08)", usage: "Raised cards" },
      "action-live": {
        value: "0 0 0 4px rgba(47, 107, 255, 0.45), 0 4px 16px rgba(0, 0, 0, 0.4)",
        usage: "Primary button while a session is running",
      },
      glow: {
        value: "0 0 24px rgba(255, 255, 255, 0.55)",
        usage: "Focus ring on dark surfaces",
      },
    },
  },
};

export default function DevTokensPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <TokenGrid system={preview} />
    </main>
  );
}
