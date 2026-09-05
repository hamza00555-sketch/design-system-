"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useScreenImage, useScreens, type ScreenDoc } from "@/lib/data";

/**
 * The screenshots the agent captured.
 *
 * They sit above the tokens because this is the question a person actually
 * arrives with — what does it look like — and a wall of hex codes answers it
 * far more slowly than one picture.
 *
 * A captured app can be forty pages, so the pictures are fetched one at a time
 * as each tile reaches the viewport. Loading them all up front would mean ten
 * megabytes before the first row is even on screen.
 */
export function ScreenGallery({ systemId }: { systemId: string | null }) {
  const t = useTranslations("tokens");
  const screens = useScreens(systemId);

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">{t("screens")}</h2>
      {screens.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          {t("noScreens")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {screens.data.map((screen) => (
            <ScreenTile key={screen.id} systemId={systemId} screen={screen} />
          ))}
        </div>
      )}
    </section>
  );
}

function ScreenTile({ systemId, screen }: { systemId: string | null; screen: ScreenDoc }) {
  const t = useTranslations("tokens");
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  const src = useScreenImage(systemId, screen, near);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    // No IntersectionObserver (old browser, a test renderer) means every tile
    // loads — correct, just less frugal.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  return (
    <figure ref={ref} className="overflow-hidden rounded-lg border border-line">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={screen.description ?? screen.name} className="block w-full" />
      ) : (
        <div className="aspect-[16/10] w-full animate-pulse bg-raised" />
      )}
      <figcaption className="border-t border-line px-3 py-2">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm">{screen.name}</span>
          {/* An impression is a mood reference, not a record of the product.
              Saying so on the card is the whole point of storing the kind. */}
          {screen.kind === "impression" ? (
            <span className="rounded border border-line px-1 py-0.5 text-[11px] text-faint">
              {t("impression")}
            </span>
          ) : null}
        </span>
        {screen.description ? (
          <span className="block text-xs text-muted">{screen.description}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
