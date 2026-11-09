# ROY fork file commit and cross-fork PR probe

This is a **manual, owner-triggered diagnostic**, not an autonomous AI writer. It uses the fork-only `ROY_FORK_TOKEN` GitHub Actions secret. Do not put the token back into Claude cloud environment variables.

## Previously verified

- 2026-11-09 Run 42588775104: `IDENTITY_SCOPE=PASS` (ROY bot identity, fork write permission, upstream not writable).
- 2026-11-09 Run 42589217190: `FORK_BRANCH_CREATE=PASS` for `mauvenation-crypto/roy-bot-jjooni` branch `roy/auth-probe-20261109`. Branch creation is **not** proof of file-commit or PR capability.

## New manual-only workflow

`.github/workflows/roy-fork-commit-pr-probe.yml` requires `mauveplace` to initiate `workflow_dispatch` on `main`, with exactly one of:

1. `verify_only` (default): confirm ROY numeric identity, fork provenance and permissions, upstream non-write. No writes.
2. `fork_commit`: create exactly `ai-collab/roy-probes/20261109-fork-commit-proof.md` in existing ROY fork branch and check authenticated committer. Re-run does not overwrite the file.
3. `upstream_pr`: only after the exact probe file exists and is the **only changed path**, try to create a draft cross-fork PR from the ROY identity. Never merge. If GitHub rejects the fine-grained PAT because the upstream repo is owned by someone else, report `BLOCKED`, with **no owner-account fallback**.

The workflow neither checks out nor executes code from forks or PRs. It does not use `pull_request_target`, scheduled triggers, release credentials, or change upstream `main`. Its default `GITHUB_TOKEN` is read-only. Never place the ROY secret in PRs, issues, code or logs.

If `upstream_pr` is BLOCKED, investigate narrowly scoped GitHub App authentication rather than broadening or impersonating credentials. Full automatic code rework remains disabled pending a separately reviewed design and end-to-end test.
