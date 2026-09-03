#!/usr/bin/env bash
#
# Deploy Miswadah's backend to Firebase.
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

say "1/5  Checking you can reach the $PROJECT project"
npx --yes firebase-tools projects:list >/dev/null 2>&1 || die \
  "Not signed in to Firebase. In Cloud Shell run:  npx firebase-tools login --no-localhost"
npx --yes firebase-tools projects:list 2>/dev/null | grep -q "$PROJECT" || die \
  "No project called '$PROJECT' on this account. Check its Project ID in the Firebase console
 (⚙ Project settings → Project ID) and re-run as:  FIREBASE_PROJECT=<the-id> bash scripts/deploy.sh"

say "2/5  Installing dependencies (a minute or two the first time)"
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
pnpm install --silent

# Rules before functions, always: they are the security boundary, and the other
# order leaves the database open in between.
say "3/5  Deploying the database rules"
npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes \
  --project "$PROJECT" --non-interactive

say "4/5  Deploying the API (this is the slow one — up to five minutes)"
npx --yes firebase-tools deploy --only functions --project "$PROJECT" --non-interactive

say "5/5  Checking it answers"
for attempt in 1 2 3 4 5 6; do
  if curl -fsS "${API}/api/health" >/dev/null 2>&1; then
    printf '\n\033[32m✓ Done. The backend is live.\033[0m\n'
    cat <<INFO

Now paste this into Vercel → your project → Settings → Environment Variables,
then press Redeploy:

  NEXT_PUBLIC_MISWADAH_API_BASE=${API}
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT}
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${PROJECT}.firebaseapp.com

The other two values (API key and App ID) come from the Firebase console:
  ⚙ Project settings → Your apps → Web app → SDK setup and configuration

INFO
    exit 0
  fi
  echo "   not up yet, waiting 15s ($attempt/6)"
  sleep 15
done

die "The deploy finished but ${API}/api/health did not answer.
 Look at the last lines above for the reason, and send them to Claude."
