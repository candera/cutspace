#!/usr/bin/env bash
# Publish only Cutspace. The main site's deploy command publishes other content.
set -euo pipefail
set +x

CUTSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_ROOT="/Users/candera/projects/craigandera.org"
cd "$CUTSPACE_ROOT"
npm test
npm run build:site

# Keep decrypted credentials in this process only; never print or save them.
CUTSPACE_AWS_ENV="$(gpg --batch -d /Users/candera/wangdera-candera-aws-creds.gpg 2>/dev/null)"
eval "$CUTSPACE_AWS_ENV"
unset CUTSPACE_AWS_ENV
source "$SITE_ROOT/tooling/aws/lib.sh"
confirm_identity
BUCKET="$(get_state bucket_name)"
DIST_ID="$(get_state distribution_id)"
if [ "$BUCKET" != "craigandera-org-site" ] || [ -z "$DIST_ID" ]; then
  echo "Unexpected site destination; inspect tooling/aws/state.json before deploying." >&2
  exit 1
fi

# Hugo copies static files into public/ on future builds. Also update the
# existing public tree so a main-site deploy without rebuilding preserves us.
# Retain old hashed assets for visitors with an older page still open.
mkdir -p "$SITE_ROOT/static/software/cutspace" "$SITE_ROOT/public/software/cutspace"
cp -R dist/. "$SITE_ROOT/static/software/cutspace/"
cp -R dist/. "$SITE_ROOT/public/software/cutspace/"

# Publish hashed assets first, then the HTML that references them. No deletion
# or bucket-wide sync: only this application's prefix is changed remotely.
aws s3 cp dist/ "s3://$BUCKET/software/cutspace/" --recursive \
  --exclude '*.html' --cache-control 'public,max-age=31536000,immutable' --only-show-errors
aws s3 cp dist/tutorial/index.html "s3://$BUCKET/software/cutspace/tutorial/index.html" \
  --content-type 'text/html; charset=utf-8' --cache-control 'no-cache' --only-show-errors
aws s3 cp dist/index.html "s3://$BUCKET/software/cutspace/index.html" \
  --content-type 'text/html; charset=utf-8' --cache-control 'no-cache' --only-show-errors
INVALIDATION_ID="$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
  --paths '/software/cutspace*' --query 'Invalidation.Id' --output text)"
echo "Uploaded Cutspace. CloudFront invalidation: $INVALIDATION_ID"
echo "Live URL (after cache propagation): https://www.craigandera.org/software/cutspace/"
