# Deploying Tokenwell

Two things ship: **Firebase** (the API, the MCP endpoint, the database and its
rules) and **Vercel** (the web app). Using the CLI is a third step that needs
no publishing.

Do Firebase first — Vercel needs the function URL that Firebase prints.

---

## 0. This is a private deployment

By default it is yours alone. The first person to sign in claims the instance;
after that, sign-up is refused and the only way in is an invitation you send.
That needs no configuration and fails closed — the safe direction if anyone
forgets to set anything.

Firebase Auth will happily create an account for anyone with a Google account
who finds the URL, so this check lives in the API, not in the sign-in button.

Two optional environment variables on the functions:

```
ALLOWED_EMAILS=you@example.com,you@work.com   # admit these addresses too
OPEN_SIGNUPS=1                                # run it as a public product
```

Use `ALLOWED_EMAILS` if you sign in with more than one account — otherwise the
second one is a stranger to it.

The web app defaults to private as well: the root goes straight to the
dashboard, and the marketing pages stay reachable by URL but stop being the
front door. `NEXT_PUBLIC_PUBLIC_SITE=1` puts the landing page back in front.

## 1. Billing is off by default

This deployment is **open**: unlimited projects, unlimited teammates,
unlimited generations, no card, no plan to choose. The plan machinery is
present but dormant, so turning it on later is one environment variable on each
side and nothing else:

```
BILLING_ENABLED=1                 # functions/.env
NEXT_PUBLIC_BILLING_ENABLED=1     # Vercel
```

Leave both unset for now. With billing off, `/api/billing/*` refuses even if
Stripe keys are present — a stray key in an environment cannot start charging
anyone — and the site advertises no price.

Skip section 3 entirely until you want to charge.

---

## 2. Firebase — API, MCP endpoint, database rules

### 2.1 Create the project

```bash
npm i -g firebase-tools          # or use npx firebase
firebase login
firebase projects:create tokenwell-prod        # or create it in the console
```

Point the repo at it. `.firebaserc` currently holds the emulator project:

```bash
firebase use --add               # pick tokenwell-prod, call the alias "prod"
```

Cloud Functions need the **Blaze** (pay-as-you-go) plan. At this traffic it
costs approximately nothing, but the project will not deploy functions without
it: console → ⚙ → Usage and billing → Modify plan.

### 2.2 Turn on sign-in

Console → **Authentication** → Get started → Sign-in method:

- Enable **Google**.
- Enable **GitHub**. It asks for a Client ID and secret: create an OAuth App at
  <https://github.com/settings/developers>, and paste Firebase's callback URL
  (`https://<project>.firebaseapp.com/__/auth/handler`) into the GitHub app's
  *Authorization callback URL*.

Then Authentication → Settings → **Authorised domains** → add your Vercel
domain (both `your-app.vercel.app` and any custom domain). Sign-in fails with
`auth/unauthorized-domain` until you do.

### 2.3 Create the database

Console → **Firestore Database** → Create database → production mode → pick a
region close to your users. Leave the default rules; you are about to replace
them.

### 2.4 Deploy the rules, the indexes, and the functions

The rules are the security boundary — they make the browser read-only, scope
every read to the caller's team, and make `projectKeys` and `connectCodes`
unreadable to any client. Deploy them **before or with** the functions, never
after:

```bash
pnpm install
pnpm --filter @tokenwell/functions build

# Rules and indexes on their own first — cheap, instant, and the safe order.
firebase deploy --only firestore:rules,firestore:indexes

# Then the API.
firebase deploy --only functions
```

`firestore.indexes.json` carries three indexes the app needs (recent
verifications, pending invitations, and the collection-group lookup that finds
which team you belong to). Firestore builds them in the background; queries
that need them fail until the build finishes, which takes a minute or two on an
empty database.

To check what the rules will do before shipping them, use the console's Rules
Playground (Firestore → Rules → Playground): a read of
`projectKeys/{anything}` as an authenticated user must be **denied**.

The deploy prints the function URL. Copy it — everything else points at it:

```
https://us-central1-tokenwell-prod.cloudfunctions.net/api
```

Sanity check:

```bash
curl https://us-central1-tokenwell-prod.cloudfunctions.net/api/api/health
# {"ok":true,"service":"tokenwell"}
```

### 2.5 Web app config

Console → ⚙ Project settings → Your apps → **Add app** → Web. Copy the config
values; Vercel wants four of them in the next section.

---

## 3. Vercel — the web app

The repo is a pnpm monorepo and the app is not at the root, so the project
settings matter more than usual.

### 3.1 Import

<https://vercel.com/new> → import `hamza00555-sketch/design-system-`.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| **Root directory** | `apps/web` |
| Build command | leave default (`next build`) |
| Install command | leave default — Vercel detects pnpm from the lockfile |
| Node version | 22 (Project Settings → General) |

**Root directory is the one that bites.** Set it to `apps/web` and tick
"Include files outside the root directory" so the workspace packages
(`packages/core`) are available to the build.

### 3.2 Environment variables

Project Settings → Environment Variables. Add these to **Production**,
**Preview**, and **Development**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=            # from 1.5
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=        # <project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=         # tokenwell-prod
NEXT_PUBLIC_FIREBASE_APP_ID=             # 1:...:web:...
NEXT_PUBLIC_TOKENWELL_API_BASE=https://us-central1-tokenwell-prod.cloudfunctions.net/api
```

Leave `NEXT_PUBLIC_FIREBASE_EMULATORS`, `NEXT_PUBLIC_BILLING_ENABLED`, and
`NEXT_PUBLIC_PUBLIC_SITE` unset — that is the private, billing-free default.

These are `NEXT_PUBLIC_`, meaning they are baked into the browser bundle and
are readable by anyone. That is correct for Firebase web config — it is an
identifier, not a secret; the rules are what protect the data. Never put a
Stripe secret key or a service-account key in a `NEXT_PUBLIC_` variable.

### 3.3 Deploy

Push to the branch, or hit Deploy. Then, once you know the domain:

1. Add it to Firebase → Authentication → Authorised domains (section 1.2).
2. Redeploy is not needed for that — it is a Firebase-side allowlist.

### 3.4 Custom domain

Vercel → Project → Settings → Domains → add `tokenwell.design`. Vercel prints
the DNS records; add them at your registrar. Then add the custom domain to the
Firebase authorised domains list too.

---

## 4. Stripe — only when you want to charge

Skipped while billing is off. When the time comes:

- Create a recurring product and copy its price id.
- `functions/.env`: `STRIPE_PRICE_ID=price_...`, `APP_URL=https://your-domain`,
  `BILLING_ENABLED=1`.
- `firebase functions:secrets:set STRIPE_SECRET_KEY`
- Add a webhook at `<API base>/api/stripe/webhook` subscribed to
  `checkout.session.completed`, `customer.subscription.updated`, and
  `customer.subscription.deleted`; copy its signing secret into
  `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.
- Set `NEXT_PUBLIC_BILLING_ENABLED=1` on Vercel and redeploy.

The signed webhook is what changes a plan. Checkout succeeding is not the event
that matters.

---

## 5. The CLI

You do not have to publish anything to npm to use this. On your own machines,
point the CLI at your deployment with an environment variable:

```bash
export TOKENWELL_API_BASE=https://us-central1-<project>.cloudfunctions.net/api
node /path/to/design-system-/packages/cli/dist/cli.js init --code XXXX-XXXX
```

Or `pnpm --filter tokenwell exec npm link` once, and then `tokenwell init`
works anywhere on that machine.

If you ever do publish it, set the default API base in
`packages/cli/src/config.ts` first — a published CLI talking to the wrong host
is the one mistake here that reaches other people's machines.

---

## 6. Check it end to end

In a scratch repo, against the real deployment:

```bash
npx tokenwell init --code <code from the dashboard's Connect screen>
```

Then in an agent session in that repo, ask for something visual. Confirm it
calls `get_design_system` first and `verify` after. Write a deliberate
`#3D7BF2` and check that verify names your `color.primary`.

---

## Before you rely on it

- [ ] `firestore.rules` deployed — the Rules Playground denies a client read of
      `projectKeys`.
- [ ] You signed in first, so the instance is claimed. Check that a second
      account is refused with "This deployment is private".
- [ ] Authorised domains include the production domain, or nobody can sign in.
- [ ] `/api/health` answers on the deployed function URL.
- [ ] A repo connected, a system pushed, and one deliberate off-brand value
      caught by verify.

The legal pages ship with a visible draft banner. That is the right state for a
private instance — ignore it. If you ever open this up, they need a real
operating entity, a real governing law, and a lawyer's read first.
