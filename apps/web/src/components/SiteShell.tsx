import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * The public frame. Unlike AppShell it guards nothing and reads nothing — the
 * marketing pages are static in both languages, which is most of why they are
 * fast.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const t = useTranslations("site.nav");
  const tf = useTranslations("site.footer");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 py-6">
        <Link href="/" className="font-mono text-sm tracking-tight">
          tokenwell
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Link href="/use-cases/design-review" className="hover:text-ink">
            {t("useCases")}
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            {t("pricing")}
          </Link>
        </nav>
        <LocaleSwitcher />
        <Link href="/sign-in" className="text-sm text-muted hover:text-ink">
          {t("logIn")}
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-raised"
        >
          {t("cta")}
        </Link>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line py-6 text-sm text-faint">
        <span>{tf("rights", { year: new Date().getFullYear() })}</span>
        <span className="flex-1" />
        <Link href="/terms" className="hover:text-ink">
          {tf("terms")}
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          {tf("privacy")}
        </Link>
      </footer>
    </div>
  );
}

export function Receipt({ label, line, caption }: { label: string; line: string; caption?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-lg border border-line bg-raised">
        <div className="border-b border-line px-4 py-2 text-xs text-faint">{label}</div>
        <code className="ltr-content block overflow-x-auto px-4 py-3 font-mono text-sm whitespace-pre">
          {line}
        </code>
      </div>
      {caption ? <figcaption className="text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  );
}

export function Steps({
  items,
}: {
  items: { title: string; body: string; code?: string }[];
}) {
  return (
    <ol className="flex flex-col gap-8">
      {items.map((item, index) => (
        <li key={item.title} className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <span className="shrink-0 font-mono text-xs text-faint sm:w-16 sm:pt-1">
            {String(index + 1).padStart(2, "0")} —
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-sm text-muted">{item.body}</p>
            {item.code ? (
              <code className="ltr-content mt-1 self-start rounded border border-line bg-raised px-2 py-1 font-mono text-xs text-muted">
                {item.code}
              </code>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Cards({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border border-line p-4">
          <h3 className="text-sm font-medium">{item.title}</h3>
          <p className="mt-2 text-sm text-muted">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line py-14">
      {title ? <h2 className="mb-8 text-xl font-medium tracking-tight">{title}</h2> : null}
      {children}
    </section>
  );
}
