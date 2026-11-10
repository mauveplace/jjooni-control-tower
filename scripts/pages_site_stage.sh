#!/usr/bin/env bash
# This exact staging operation is validated by CI and used for Pages publication.
set -euo pipefail
site="$1"
test -n "$site"
mkdir -p "$site"
rsync -a --exclude='/.git/' --exclude='/.github/' \
  --exclude='/ai-collab/' --exclude='/ai-collab-dispatch/' \
  --exclude='/tools/' --exclude='/tests/' --exclude='/scripts/' \
  ./ "$site/"

# Only the 439 live, index-addressed series are needed by the UI. Historical
# revisions remain immutable in GitHub but never enter the Pages upload.
python3 scripts/pages_calendar_prune.py "$site"

for required in index.html market-observatory/index.html \
  market-observatory/data/observatory.json \
  market-observatory/data/economic-calendar-history.json \
  public-market-daily.json .nojekyll; do
  if [[ ! -f "$site/$required" ]]; then
    echo "::error::Missing required public Pages asset: $required"
    exit 1
  fi
done
for forbidden in .git .github ai-collab ai-collab-dispatch tools tests scripts; do
  if [[ -e "$site/$forbidden" ]]; then
    echo "::error::Non-public source directory included: $forbidden"
    exit 1
  fi
done
python3 scripts/pages_site_audit.py "$site"
echo "PAGES_SITE_STAGE=PASS"
du -sh "$site"
