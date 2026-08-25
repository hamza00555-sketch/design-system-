# Deploying Tokenwell

Three things ship separately: the Cloud Functions (the API and the MCP
endpoint), the web app, and the CLI on npm. Nothing here needs the others to be
deployed first, except that the CLI's default endpoint has to match wherever
the functions ended up.

## 1. Firebase — the API and the MCP endpoint

```bash
firebase login
firebase use --add                    # pick or create the project
```

Set the billing secrets (they live in Secret Manager, never in the repo):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Non-secret config goes in `functions/.env`:

```
STRIPE_PRICE_ID=price_...          # the $29/mo recurring price
APP_URL=https://your-web-app        # where Stripe returns people after checkout
```

Then:

```bash
pnpm --filter @tokenwell/functions build
firebase deploy --only functions,firestore:rules,firestore:indexes
```

The deploy prints the function URL. That URL is the API base everything else
points at:

```
https://us-central1-<project>.cloudfunctions.net/api
```

Enable **Google** and **GitHub** as sign-in providers in the Firebase console
(Authentication → Sign-in method), and add the web app's domain under
Authentication → Settings → Authorised domains.

## 2. Stripe

- Create a recurring product at $29/mo and copy its price id into
  `STRIPE_PRICE_ID`.
- Add a webhook endpoint pointing at `<API base>/api/stripe/webhook`, and
  subscribe it to `checkout.session.completed`,
  `customer.subscription.updated`, and `customer.subscription.deleted`.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The webhook is what actually changes a plan. Checkout succeeding is not the
event that matters — the signed webhook is.

## 3. The web app

Any host that runs Next.js works; the app is static apart from the invitation
and version pages. Set these environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_TOKENWELL_API_BASE=https://us-central1-<project>.cloudfunctions.net/api
```

Leave `NEXT_PUBLIC_FIREBASE_EMULATORS` unset in production.

```bash
pnpm --filter @tokenwell/web build
```

## 4. The CLI on npm

`packages/cli/src/config.ts` carries the default API base. Point it at your
deployment before publishing — a published CLI that talks to the wrong host is
the one mistake here that reaches other people's machines.

```bash
pnpm --filter tokenwell exec npm pack --dry-run   # 6 files, no source, no keys
pnpm --filter tokenwell publish --access public
```

Anyone can override it without a republish:

```bash
TOKENWELL_API_BASE=https://your-api npx tokenwell init
```

## 5. Check it end to end

Against the real deployment, in a scratch repo:

```bash
npx tokenwell init --code <code from the dashboard>
```

Then in an agent session in that repo: ask for something visual, and confirm it
calls `get_design_system` first and `verify` after. Push a deliberate `#3D7BF2`
and check that verify names `color.primary`.

## Before launch

- [ ] `firestore.rules` deployed — the client must be read-only.
- [ ] Authorised domains include the production web domain.
- [ ] Stripe is in live mode, and the webhook secret is the live one.
- [ ] `APP_URL` matches the deployed web app, or checkout returns people
      to the wrong place.
- [ ] The legal pages in `apps/web/src/content/legal.ts` have a real operating
      entity, a real governing law, and a lawyer's read. They ship with a
      visible draft banner until then.
- [ ] Decide what happens on the free plan when a team's subscription lapses
      with two projects connected. Today the limit is only checked at connect
      time, so both keep working — that is a deliberate grace, not an
      oversight, but it should be a decision someone made on purpose.
