# Pages deployment reliability: evidence and activation gate (2026-11-10 KST)

## Confirmed incident

- GitHub Pages run 42718294283, job 129505569318: build SUCCESS, deploy FAILURE. Log: syncing_files for approximately 10 minutes followed by Timeout reached, aborting.
- Run 42701136815 / job 129446042854: same failure mode.
- Run 42732437750 / job 129553660258: same failure **after** #351.
- Run 42732278493: successful Pages build/deploy. One success does not erase failures.
- Automatic Pages artifact about 16.9 MB. Large histories and frequent data commits are possible contributors, but the remote service's underlying stall remains unproven.

## Source and fix boundaries

PR #351 removed Pages-deployment-completion as a trigger for Observatory refresh without changing source collection or trading signals. PR #353 stages a controlled deploy, but it is OFF until the owner changes Pages Source to GitHub Actions and enables the repository variable.

Planned controlled deploy:
- One publish opportunity per 15-minute slot, serialized, with explicit timeout.
- Verify the latest deployment status and exact source SHA; skip only confirmed same-SHA success. Retry on failure or API uncertainty.
- Pin the deployed Git commit, and run the same public site staging and static reference audit in PR CI and the deployment workflow.
- Keep all public market histories and the existing data-source refresh schedules.

## Explicit activation blockers

1. Final PR-head CI and independent ROY review PASS, owner approval.
2. Verify end-user data-freshness tolerance, not just green GitHub workflow status. Proposed trial objective: published Observatory JSON age p95 <=25 minutes; no successful Pages publish for 45 minutes must produce a deduplicated alert. These are proposed thresholds, not achieved SLAs.
3. Confirm the existing user-visible freshness UI shows stale data prominently; if it does not, add an explicit stale indicator before migration.
4. Implement and test the deduplicated Pages deployment-gap alert and recovery logic.
5. Dry-run exact static bundle and test no-change, successful deploy, failure retry, and public revision alignment, without switching Pages source.

## Activation and rollback (owner-operated)

After passing the blockers, change GitHub repository Settings > Pages > Build and deployment > Source to GitHub Actions, then set repository Actions variable PAGES_ACTIONS_ENABLED=true. Trigger one controlled deploy and verify actual published revision and public data timestamps.

To roll back: set PAGES_ACTIONS_ENABLED=false AND restore the previous Deploy from a branch source setting. Verify an actually served page; toggling only the variable is not rollback.

No settings have been changed, no error emails suppressed, and no claim is made that remote syncing_files timeouts are eliminated.
