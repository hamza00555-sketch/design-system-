# apps/web — the dashboard

Next.js 16 (App Router) + Firebase Auth + Firestore, in Arabic and English.

## Language: Arabic and English, both first-class

Neither language is a translation layer over the other.

- Locale-prefixed routes (`/en/...`, `/ar/...`) via `next-intl`, with `<html
  lang dir>` set per locale in `src/app/[locale]/layout.tsx`.
- **Every layout works in RTL.** Logical CSS properties throughout — Tailwind's
  `ps-*`/`pe-*`/`ms-*`/`me-*`, never `pl-*`/`pr-*`, never `left`/`right`.
- No copy hardcoded in components; every string comes from
  `src/messages/{en,ar}.json`. The two files carry identical key sets.
- Arabic gets more line height than Latin at the same size (`globals.css`),
  because the same leading that reads well in English crowds Arabic.
- Anything that is read as code — a shell command, a hex value, a token name —
  is wrapped in `.ltr-content`, which isolates its direction. `#2f6bff` reads
  the same way in every language.
- Numbers, dates, and plurals go through `next-intl`'s `Intl` formatters.
  Arabic plural rules have six categories; the catalogue spells them out.

## Routes

| Route | What it does |
| --- | --- |
| `/[locale]` | redirects to the dashboard (marketing lands here in phase 4) |
| `/[locale]/sign-in` | Google and GitHub, no passwords |
| `/[locale]/dashboard` | current system, live verification receipts, exports |
| `/[locale]/dashboard/history` | every version, with restore |
| `/[locale]/dashboard/history/[versionId]` | one version, with export |
| `/[locale]/onboarding/connect` | mints a connect code and shows the command |
| `/[locale]/systems` | the team's system and the projects on it |
| `/[locale]/settings/billing` | plan, usage against the limits, Stripe checkout and portal |
| `/[locale]/settings/members` | people, roles, invitations |
| `/[locale]/settings/support` | how to reach a person |
| `/[locale]/invite/[token]` | accepting an invitation |

## How it talks to the backend

Reads come straight from Firestore over the client SDK and stay live —
`onSnapshot`, so a push from an agent updates the dashboard without a refresh.
**Every write goes through the Cloud Function** in `functions/`, authenticated
with a Firebase ID token: `/api/me/bootstrap`, `/api/connect-codes`,
`/api/versions/restore`, `/api/members/*`, `/api/billing/*`. Stripe posts to
`/api/stripe/webhook`, which authenticates by signature over the raw body
rather than by a token.

Two pages listen to the team document directly, so a plan change lands on the
screen the moment Stripe's webhook is processed — no refresh, no polling. The security rules make the client read-only, so there
is no privileged path through the browser.

Export is the exception that needs no server at all: the version document
already holds the whole system, so `DESIGN.md` and the W3C tokens JSON are
generated in the browser from `@tokenwell/core`.

## Running it locally

```bash
cp apps/web/.env.example apps/web/.env.local   # then fill it in
pnpm --filter @tokenwell/functions build
npx firebase emulators:start --project demo-tokenwell --only auth,firestore,functions
pnpm --filter @tokenwell/web dev
```

For the emulators, `.env.local` wants the demo values and
`NEXT_PUBLIC_FIREBASE_EMULATORS=1`; the API base is
`http://127.0.0.1:5001/demo-tokenwell/us-central1/api`.

One caveat if you are running inside a sandbox that intercepts TLS:
`signInWithPopup` loads `apis.google.com`, so the popup will hang there even
though every other part of the stack works against the emulators.
