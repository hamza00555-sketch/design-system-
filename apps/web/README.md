# apps/web — dashboard and marketing site (phase two)

Not built yet. This file records the decisions already made, so phase two
starts from a brief rather than a blank page.

## Language: Arabic and English, both first-class

The site ships bilingual. This is a structural requirement, not a translation
pass bolted on later:

- Locale-prefixed routes (`/ar/...`, `/en/...`) with `next-intl`, and `<html
  lang dir>` set per locale.
- **Every layout must work in RTL.** Use logical CSS properties throughout
  (`padding-inline-start`, `margin-inline`, `inset-inline-start`) — never
  `left`/`right`. Tailwind's `ps-*`/`pe-*`/`ms-*`/`me-*` utilities, never
  `pl-*`/`pr-*`.
- No copy hardcoded in components; all strings come from message catalogues so
  neither language is the afterthought.
- Numerals, dates, and currency through `Intl`, per locale.
- The Arabic side gets its own typographic scale — Arabic text needs more line
  height than Latin at the same size.

## Routes

```
/                                  marketing
/use-cases/design-review
/use-cases/design-system-storage
/pricing · /privacy · /terms
/sign-in · /sign-up                Firebase Auth (Google + GitHub)
/onboarding/{extract,prompt,connect,result,upgrade}
/dashboard                         current system, live verification receipts
/dashboard/history                 versions
/dashboard/history/[versionId]     one version, with restore
/systems                           every system on the team
/settings/{billing,members,support}
```

## Notes

- Data comes from Firestore with the client SDK, read-only — every write goes
  through the Cloud Functions in `functions/`.
- The connect screen mints a code (15-minute TTL, single use) and shows
  `npx tokenwell init --code XXXX-XXXX`.
- Billing is Stripe, per team, monthly. The free plan is one system, one
  project, one person.
- Keep the interface neutral — black, white, and grey — so the only opinionated
  colours on screen belong to the customer's design system.
