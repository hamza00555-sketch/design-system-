"use client";

import { useTranslations } from "next-intl";
import { useScreens } from "@/lib/data";

/**
 * The screenshots the agent captured.
 *
 * They sit above the tokens because this is the question a person actually
 * arrives with — what does it look like — and a wall of hex codes answers it
 * far more slowly than one picture.
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
            <figure key={screen.id} className="overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.src}
                alt={screen.description ?? screen.name}
                className="block w-full"
              />
              <figcaption className="border-t border-line px-3 py-2">
                <span className="text-sm">{screen.name}</span>
                {screen.description ? (
                  <span className="block text-xs text-muted">{screen.description}</span>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
