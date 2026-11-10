# Pages deployment migration (staged; not active)

## Objective
Separate the static GitHub Pages publish cadence from frequent data commits to `main`.
The current branch-based Pages source spawns `pages build and deployment`
for almost every commit; superseded builds can be cancelled. This is not
a quote collection failure.

## Current safety state
- `.github/workflows/pages-controlled-deploy.yml` exists but its deploy job
  is **disabled** unless `PAGES_ACTIONS_ENABLED=true` is set in Actions variables.
- The existing Pages source and live website are **unchanged**.
- The old root export is `path: .` with `.nojekyll`; the replacement keeps
  that exact site root.
- Current BTC/ETH prices use the public Binance endpoint on open, resume or manual refresh.
  Other supported current quotes use the read-only Cloud Run `/observatory/quotes` endpoint.
- The staged workflow currently has only `workflow_dispatch`. A demand-aware trigger
  for static data must be reviewed before changing the active Pages Source.
- The repository is public; review published paths as before.

## Human activation (do both in the same maintenance window)
1. GitHub repository **Settings > Pages > Build and deployment > Source**:
   select **GitHub Actions** (instead of Deploy from a branch).
2. GitHub repository **Settings > Secrets and variables > Actions > Variables**:
   create or set `PAGES_ACTIONS_ENABLED` to the literal `true`.
   This is a non-secret opt-in flag.
3. Open **Actions > Pages Controlled Deployment**, choose **Run workflow**
   on `main`, and verify a completed **SUCCESS** deployment.
4. Verify the Control Tower root and `/market-observatory/` both load,
   and compare source-generated timestamps with deployed JSON. Probe BTCUSD
   and ETHUSD runtime quotes separately from the Pages publish timestamp.

**Do not** set the variable before changing Pages Source; otherwise an Actions
deployment can be attempted against branch-source configuration.
If the variable is missing or is not `true`, a manual execution skips
the deployment job and does not replace the current website.

## Behavior after activation
- The current staged workflow runs on manual dispatch only. A reviewed publishing
  trigger is needed before using it for normal operations.
- Each run checks out current `main` and deploys the same root `.`.
- Deployment concurrency prevents overlapping deploy jobs.
- Data jobs may continue to publish `main`; they no longer separately
  trigger a Pages deployment once the Pages Source setting is switched.
- With only manual dispatch, Pages JSON can remain old until an operator
  publishes again. Confirm the actual source-to-Pages delay on a reviewed
  publishing trigger before migration.

## Rollback
1. Set `PAGES_ACTIONS_ENABLED=false` to disable the Actions deployment.
2. In **Settings > Pages**, change Source back to **Deploy from a branch**
   using the original branch and root directory.
3. Verify the built-in `pages build and deployment` run succeeds.
4. Investigate missing files / URL paths before any future reactivation.

## Monitoring
Track actual deploy successes and failures separately from collectors.
A superseded branch Pages run that is cancelled should not be recorded
as an upstream price collection error. Keep an independent stale-data
signal based on `quote_as_of_kst` and the published data's `generated_kst`.

## Non-production staging evidence

On source `47ecb59a0c7a025a2998e74c9feb2c1706479ad1`, a comparable local
tar/gzip estimate was 17,474,797 bytes for tracked files and 7,192,380 bytes
for the curated file list. The archive index referenced 439 series; the
staging check verified their SHA-256 checksums and discarded 2,976
unreferenced revisions from the staging copy. These are local archive
measurements. Production deployment success and freshness still require
a controlled cutover with rollback.
