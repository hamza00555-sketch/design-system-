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

      {/* Four states, told apart. They used to collapse into one: a refused
          read rendered as "no screenshots yet", which is the most misleading
          thing this page could say — it blames the data for a permission
          problem, and there is nothing on screen to suggest otherwise. */}
      {screens.error ? (
        <div className="rounded-lg border border-fail px-4 py-4 text-sm">
          <p className="text-fail">{t("screensError")}</p>
          <p className="ltr-content mt-1 font-mono text-xs break-all text-faint">
            {screens.error}
          </p>
          {systemId ? (
            <p className="ltr-content mt-2 font-mono text-xs text-faint">system: {systemId}</p>
          ) : null}
        </div>
      ) : screens.loading ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          {t("screensLoading")}
        </p>
      ) : screens.data.length === 0 ? (
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
  const image = useScreenImage(systemId, screen, near);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    // No IntersectionObserver (old browser, a test renderer) means every tile
    // loads — correct, just less frugal.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    // A tile inside a collapsed panel or an unopened tab has zero size and
    // never intersects, so it would sit unloaded forever. Checking the
    // measured box on mount catches that and falls back to loading it.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    const box = node.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) setNear(true);
    return () => observer.disconnect();
  }, [near]);

  return (
    <figure ref={ref} className="min-w-0 overflow-hidden rounded-lg border border-line">
      {image.state === "loaded" && image.src ? (
        <a href={image.src} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.src} alt={screen.description ?? screen.name} className="block w-full" />
        </a>
      ) : image.state === "missing" || image.state === "error" ? (
        <div className="flex aspect-[16/10] w-full flex-col items-start justify-center gap-2 bg-raised px-4">
          <p className="text-xs text-fail">
            {image.state === "missing" ? t("imageMissing") : t("screensError")}
          </p>
          {image.error ? (
            <p className="ltr-content font-mono text-[11px] break-all text-faint">{image.error}</p>
          ) : null}
          <button
            type="button"
            onClick={image.retry}
            className="rounded-md border border-line-strong px-2 py-1 text-xs text-muted transition hover:bg-surface hover:text-ink"
          >
            {t("retry")}
          </button>
        </div>
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
