"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useScreenImage, useScreens, type ScreenDoc } from "@/lib/data";

/**
 * The screenshots an agent captured.
 *
 * Two surfaces, because they answer different questions. The dashboard gets a
 * card — how many pictures are there, and roughly what do they look like —
 * because forty full-width images buried every other section under a mile of
 * scrolling. The gallery page gets the pictures themselves.
 */

export type ViewMode = "grid" | "stack";
const VIEW_KEY = "miswadah.screens.view";

/* ------------------------------------------------------------------ card */

export function ScreensCard({ systemId }: { systemId: string | null }) {
  const t = useTranslations("tokens");
  const screens = useScreens(systemId);

  return (
    <section className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">{t("screens")}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {screens.error
              ? t("screensError")
              : screens.loading
                ? t("screensLoading")
                : screens.data.length === 0
                  ? t("noScreens")
                  : t("screenCount", { count: screens.data.length })}
          </p>
        </div>
        {screens.data.length > 0 ? (
          <Link
            href="/dashboard/screens"
            className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:bg-raised hover:text-ink"
          >
            {t("viewAll")}
          </Link>
        ) : null}
      </div>

      {screens.error ? (
        <div className="border-t border-line px-4 py-3">
          <p className="ltr-content font-mono text-xs break-all text-fail">{screens.error}</p>
          {systemId ? (
            <p className="ltr-content mt-1 font-mono text-xs text-faint">system: {systemId}</p>
          ) : null}
        </div>
      ) : screens.data.length > 0 ? (
        // A handful of thumbnails, not forty: this is a preview, and the rest
        // are one tap away on a page built to show them.
        <div className="grid grid-cols-3 gap-2 border-t border-line p-3 sm:grid-cols-4">
          {screens.data.slice(0, 4).map((screen) => (
            <Thumb key={screen.id} systemId={systemId} screen={screen} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Thumb({ systemId, screen }: { systemId: string | null; screen: ScreenDoc }) {
  const { ref, near } = useNearViewport();
  const image = useScreenImage(systemId, screen, near);
  return (
    <div
      ref={ref}
      className="aspect-[4/3] overflow-hidden rounded-md border border-line bg-raised"
    >
      {image.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={screen.name} className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- gallery */

export function ScreenGallery({ systemId }: { systemId: string | null }) {
  const t = useTranslations("tokens");
  const screens = useScreens(systemId);
  const [view, setView] = useState<ViewMode>("grid");
  const [openAt, setOpenAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "grid" || saved === "stack") setView(saved);
    } catch {
      // A remembered layout is a convenience, not something to interrupt over.
    }
  }, []);

  const choose = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* see above */
    }
  };

  if (screens.error) {
    return (
      <div className="rounded-lg border border-fail px-4 py-4 text-sm">
        <p className="text-fail">{t("screensError")}</p>
        <p className="ltr-content mt-1 font-mono text-xs break-all text-faint">{screens.error}</p>
        {systemId ? (
          <p className="ltr-content mt-2 font-mono text-xs text-faint">system: {systemId}</p>
        ) : null}
      </div>
    );
  }
  if (screens.loading) return <p className="text-sm text-muted">{t("screensLoading")}</p>;
  if (screens.data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
        {t("noScreens")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("screenCount", { count: screens.data.length })}</p>
        <div className="flex gap-1 rounded-md border border-line p-0.5">
          {(["grid", "stack"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => choose(mode)}
              aria-pressed={view === mode}
              className={`rounded px-2.5 py-1 text-xs transition ${
                view === mode ? "bg-ink text-canvas" : "text-muted hover:text-ink"
              }`}
            >
              {t(mode === "grid" ? "viewGrid" : "viewStack")}
            </button>
          ))}
        </div>
      </div>

      <div className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-6"}>
        {screens.data.map((screen, index) => (
          <ScreenTile
            key={screen.id}
            systemId={systemId}
            screen={screen}
            view={view}
            onOpen={() => setOpenAt(index)}
          />
        ))}
      </div>

      {openAt !== null ? (
        <Lightbox
          systemId={systemId}
          screens={screens.data}
          at={openAt}
          onMove={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </div>
  );
}

function ScreenTile({
  systemId,
  screen,
  view,
  onOpen,
}: {
  systemId: string | null;
  screen: ScreenDoc;
  view: ViewMode;
  onOpen: () => void;
}) {
  const t = useTranslations("tokens");
  const { ref, near } = useNearViewport();
  const image = useScreenImage(systemId, screen, near);

  return (
    <figure ref={ref} className="min-w-0 overflow-hidden rounded-lg border border-line">
      {image.state === "loaded" && image.src ? (
        <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in">
          {/* Grid crops to a common shape so the rows line up; stack shows the
              whole screen at its own proportions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={screen.description ?? screen.name}
            className={view === "grid" ? "aspect-[4/3] w-full object-cover" : "block w-full"}
          />
        </button>
      ) : image.state === "missing" || image.state === "error" ? (
        <div className="flex aspect-[4/3] w-full flex-col items-start justify-center gap-2 bg-raised px-4">
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
        <div className="aspect-[4/3] w-full animate-pulse bg-raised" />
      )}

      <figcaption className="border-t border-line px-3 py-2">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm">{screen.name}</span>
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

/* -------------------------------------------------------------- lightbox */

/**
 * The full-size viewer.
 *
 * An overlay rather than a link to the image: these are `data:` URLs, and
 * browsers have refused top-level navigation to `data:` for years, so opening
 * one in a tab silently does nothing.
 */
function Lightbox({
  systemId,
  screens,
  at,
  onMove,
  onClose,
}: {
  systemId: string | null;
  screens: ScreenDoc[];
  at: number;
  onMove: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("tokens");
  const screen = screens[at]!;
  const image = useScreenImage(systemId, screen, true);

  const step = useCallback(
    (delta: number) => onMove((at + delta + screens.length) % screens.length),
    [at, screens.length, onMove],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the viewer is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={screen.name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
    >
      <div className="flex items-center justify-between gap-3 text-sm text-white">
        <span className="min-w-0 truncate">
          {screen.name}
          <span className="ms-2 text-white/50">
            {at + 1}/{screens.length}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/25 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10"
        >
          {t("close")}
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center py-3"
        onClick={(event) => event.stopPropagation()}
      >
        {image.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={screen.description ?? screen.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-white/60">
            {image.state === "missing" ? t("imageMissing") : t("screensLoading")}
          </p>
        )}
      </div>

      <div
        className="flex items-center justify-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shared */

/**
 * True once the element is near the viewport, so its picture is fetched then
 * and not before. A tile inside a collapsed panel has a zero-sized box and
 * would never intersect, so that case falls back to loading immediately.
 */
function useNearViewport() {
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
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
    const box = node.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) setNear(true);
    return () => observer.disconnect();
  }, [near]);

  return { ref: ref as React.RefObject<never>, near };
}
