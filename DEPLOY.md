# Deploying Miswadah

Two things ship: **Vercel** (the site *and* the API) and **Firebase** (sign-in
and the database). No billing account, no credit card.

## Why the API is on Vercel

Deploying Firebase Cloud Functions requires the paid **Blaze** plan — the
Firebase docs are explicit: "to deploy functions, your project must be on the
Blaze pricing plan." Firestore and Authentication are free on **Spark**.

So the API runs on Vercel, where the site already is, as one serverless
function at `apps/web/src/pages/api/[[...path]].ts`. It is a thin host over
`@miswadah/api`, which holds the actual logic and knows nothing about who runs
it. `functions/` is the same API on Firebase, kept for anyone who does upgrade
to Blaze — nothing here needs it.

That means Firebase is used only for what is free: sign-in and the database.

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

### 2.0 If you do not use a terminal

Everything below can be done from a browser. Two ways, and you only need one:

**A — Google Cloud Shell (simplest).** Open <https://shell.cloud.google.com>.
It is a terminal in a browser tab, already signed in as your Google account, so
there is no install and no `firebase login`. Paste one line:

```bash
git clone -b claude/eyedropper-analysis-plan-63mnst https://github.com/hamza00555-sketch/design-system-.git && bash design-system-/scripts/deploy.sh
```

The script checks you can reach the project, installs, deploys the rules and
then the API, waits for it to answer, and prints the exact environment
variables to paste into Vercel. If anything fails it says which step and why.

**B — GitHub Actions (a button, after a one-time setup).** This repo has a
**Deploy Firebase** workflow. To let it act as you:

1. <https://console.cloud.google.com/iam-admin/serviceaccounts> → select the
   **miswadah** project → **Create service account** → name it `deployer`.
2. Grant it these roles: *Firebase Admin*, *Cloud Functions Admin*,
   *Cloud Run Admin*, *Artifact Registry Administrator*, *Cloud Build Editor*,
   and *Service Account User*. Fewer than that and the functions deploy fails
   part-way with a permission error.
3. Open the service account → **Keys** → Add key → JSON → it downloads a file.
4. GitHub → your repo → Settings → Secrets and variables → Actions → **New
   repository secret**, named `FIREBASE_SERVICE_ACCOUNT`, and paste the whole
   contents of that JSON file.
5. Actions tab → **Deploy Firebase** → **Run workflow**.

The workflow deploys rules first, then the functions, then checks that
`/api/health` answers and prints the API base URL you need for Vercel.

That JSON key can deploy to your project. Keep it in the GitHub secret and
delete the downloaded copy.

Sections 2.1 to 2.3 are console clicks either way — do those first.

### 2.1 Create the project

```bash
npm i -g firebase-tools          # or use npx firebase
firebase login
firebase projects:create miswadah              # or create it in the console
```

Point the repo at it. `.firebaserc` currently holds the emulator project:

```bash
firebase use --add               # pick miswadah
# .firebaserc in this repo already defaults to "miswadah" — this only adds an alias.
```

Cloud Functions need the **Blaze** (pay-as-you-go) plan. At this traffic it
costs approximately nothing, but the project will not deploy functions without
it: console → ⚙ → Usage and billing → Modify plan.

### 2.2 Turn on sign-in

Console → **Authentication** → Get started → Sign-in method:

- Enable **Google**.
- Enable **GitHub**. It asks for a Client ID and secret: create an OAuth App at
  <https://github.com/settings/developers>, and paste Firebase's callback URL
  (`https://miswadah.firebaseapp.com/__/auth/handler`) into the GitHub app's
  *Authorization callback URL*.

Then Authentication → Settings → **Authorised domains** → add your Vercel
domain (both `your-app.vercel.app` and any custom domain). Sign-in fails with
`auth/unauthorized-domain` until you do.

### 2.3 Create the database

Console → **Firestore Database** → Create database → production mode → pick a
region close to your users. Leave the default rules; you are about to replace
them.

### 2.4 Publish the database rules

The rules are the security boundary: they make the browser read-only, scope
every read to the caller's team, and hide `projectKeys` and `connectCodes` from
every client. **Deploying rules does not need Blaze** — and you can do it
without a terminal at all:

Firebase console → **Firestore Database** → **Rules** tab → select everything
in the editor, replace it with the contents of `firestore.rules` from this
repo, and press **Publish**.

Indexes: console → Firestore → **Indexes** → create the ones listed in
`firestore.indexes.json`, or simpler, use the app once and click the link
Firestore puts in the error when a query needs an index it does not have.

With a terminal (Cloud Shell counts) both go out in one command:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project miswadah
```

The rules are the security boundary — they make the browser read-only, scope
every read to the caller's team, and make `projectKeys` and `connectCodes`
unreadable to any client. Deploy them **before or with** the functions, never
after:

```bash
pnpm install
pnpm --filter @miswadah/functions build

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
https://us-central1-miswadah.cloudfunctions.net/api
```

Sanity check:

```bash
curl https://us-central1-miswadah.cloudfunctions.net/api/api/health
# {"ok":true,"service":"miswadah"}
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
| Build command | leave default — it runs the app's own `build` script |
| Install command | leave default — Vercel detects pnpm from the lockfile |
| Node version | 22 (Project Settings → General) |

**Root directory is the one that bites.** Set it to `apps/web` and tick
"Include files outside the root directory" so the workspace packages
(`packages/core`) are available to the build.

Do **not** override the build command with a bare `next build`. The app's own
build script is `pnpm --filter @miswadah/core build && next build`, and the
first half is not optional: `@miswadah/core` resolves through its `dist/`,
which is gitignored, so on a fresh clone there is nothing to import until it is
built. Replacing the script with `next build` gives
`Module not found: Can't resolve '@miswadah/core'`.

### 3.2 Environment variables

Project Settings → Environment Variables. Add these to **Production**,
**Preview**, and **Development**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=            # from 1.5
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=miswadah.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=miswadah
NEXT_PUBLIC_FIREBASE_APP_ID=             # 1:...:web:...
NEXT_PUBLIC_MISWADAH_API_BASE=https://<your-site>.vercel.app
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... the whole JSON ... }
```

`NEXT_PUBLIC_MISWADAH_API_BASE` is your own site's address, because the API is
part of it now.

`FIREBASE_SERVICE_ACCOUNT` is the one secret here: it is how the API writes to
Firestore. Get it from the Firebase console → ⚙ **Project settings** →
**Service accounts** → **Generate new private key** → paste the whole
downloaded file into that one variable. It must **not** start with
`NEXT_PUBLIC_` — that prefix would ship it to every visitor's browser.

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

Vercel → Project → Settings → Domains → add `miswadah.design`. Vercel prints
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
export MISWADAH_API_BASE=https://us-central1-miswadah.cloudfunctions.net/api
node /path/to/design-system-/packages/cli/dist/cli.js init --code XXXX-XXXX
```

Or `pnpm --filter miswadah exec npm link` once, and then `miswadah init`
works anywhere on that machine.

If you ever do publish it, set the default API base in
`packages/cli/src/config.ts` first — a published CLI talking to the wrong host
is the one mistake here that reaches other people's machines.

---

## 5b. Connecting a repo without a terminal

The dashboard's Connect screen has two ways in.

**The prompt.** Press "Create a project and show me the prompt", copy what it
gives you, and paste it into your agent inside the repo you want on brand. The
prompt carries the address and the key, so the agent pushes with one HTTP
request. Nothing to install.

That prompt contains a project key. Anyone holding it can read and replace that
project's design system, so keep it to your own agent.

**The CLI.** The prompt is enough to push a system. The MCP server is what
makes an agent consult the system and verify its own output *without being
asked*, on every edit — that is the part worth wiring up properly once the repo
matters.

The plain endpoints, if you ever want them directly:

```
POST <base>/api/systems/push     Authorization: Bearer <project key>
POST <base>/api/systems/verify   {"files":[{"path":"…","content":"…"}]}
GET  <base>/api/systems/current
```

## 6. Check it end to end

In a scratch repo, against the real deployment:

```bash
npx miswadah init --code <code from the dashboard's Connect screen>
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
