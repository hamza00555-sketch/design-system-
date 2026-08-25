import { LEGAL, type LegalLocale } from "@/content/legal";
import { SiteShell } from "./SiteShell";

export function LegalPage({
  locale,
  document,
}: {
  locale: string;
  document: "privacy" | "terms";
}) {
  const key: LegalLocale = locale === "ar" ? "ar" : "en";
  const doc = LEGAL[key][document];

  return (
    <SiteShell>
      <article className="flex max-w-2xl flex-col gap-8 py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-medium tracking-tight">{doc.title}</h1>
          <p className="text-sm text-faint">{doc.updated}</p>
          <p className="rounded-lg border border-line bg-raised px-4 py-3 text-sm text-muted">
            {doc.draftNotice}
          </p>
          <p className="text-muted">{doc.intro}</p>
        </header>

        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </SiteShell>
  );
}
