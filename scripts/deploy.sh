#!/usr/bin/env bash
#
# Publish Miswadah's Firestore rules and indexes.
#
# The API is not deployed here — it ships with the site on Vercel, because
# deploying Cloud Functions would require Firebase's paid Blaze plan.
#
# Written for Google Cloud Shell (https://shell.cloud.google.com), where you
# are already signed in — so there is nothing to install and no login step.
#
#   bash scripts/deploy.sh
#
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-miswadah}"
API="https://us-central1-${PROJECT}.cloudfunctions.net/api"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/.."

say "1/3  Checking you can reach the $PROJECT project"
npx --yes firebase-tools projects:list >/dev/null 2>&1 || die \
  "Not signed in to Firebase. In Cloud Shell run:  npx firebase-tools login --no-localhost"
npx --yes firebase-tools projects:list 2>/dev/null | grep -q "$PROJECT" || die \
  "No project called '$PROJECT' on this account. Check its Project ID in the Firebase console
 (⚙ Project settings → Project ID) and re-run as:  FIREBASE_PROJECT=<the-id> bash scripts/deploy.sh"

say "2/3  Installing dependencies (a minute or two the first time)"
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
pnpm install --silent

# Rules before functions, always: they are the security boundary, and the other
# order leaves the database open in between.
say "3/3  Publishing the database rules and indexes"
npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes \
  --project "$PROJECT" --non-interactive

printf '\n\033[32m✓ Done. The rules are live.\033[0m\n'
cat <<INFO

Nothing else to deploy here — the API ships with the site on Vercel.

In Vercel → Settings → Environment Variables, make sure you have:

  NEXT_PUBLIC_MISWADAH_API_BASE=https://<your-site>.vercel.app
  FIREBASE_SERVICE_ACCOUNT=<the whole service-account JSON>
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT}
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${PROJECT}.firebaseapp.com

then press Redeploy.

INFO
