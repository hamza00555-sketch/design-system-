"use client";

import { useState } from "react";

/**
 * The gallery's two layouts, drawn from local sample images.
 *
 * The real gallery reads Firestore, which needs a signed-in workspace and a
 * pushed system — too expensive a setup for "does the grid line up on a
 * phone". This renders the same two layouts against fixed data.
 */
const SAMPLES = Array.from({ length: 9 }, (_, i) => ({
  id: `s${i}`,
  name: ["dashboard", "settings", "sign-in", "empty-state", "profile", "search", "error", "onboarding", "billing"][i]!,
  description: "A sample screen",
  tall: i % 3 === 0,
}));

export default function DevScreensPage() {
  const [view, setView] = useState<"grid" | "stack">("grid");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{SAMPLES.length} screenshots</p>
        <div className="flex gap-1 rounded-md border border-line p-0.5">
          {(["grid", "stack"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded px-2.5 py-1 text-xs transition ${
                view === mode ? "bg-ink text-canvas" : "text-muted hover:text-ink"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-6"}>
        {SAMPLES.map((s) => (
          <figure key={s.id} className="min-w-0 overflow-hidden rounded-lg border border-line">
            <div
              className={`w-full bg-raised ${view === "grid" ? "aspect-[4/3]" : s.tall ? "h-96" : "h-64"}`}
            />
            <figcaption className="border-t border-line px-3 py-2">
              <span className="text-sm">{s.name}</span>
              <span className="block text-xs text-muted">{s.description}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
