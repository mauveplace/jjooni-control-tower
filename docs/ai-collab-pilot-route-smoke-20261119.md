# ROY Pilot Review Routine — branch-neutral end-to-end smoke test

**Test date (KST):** 2026-11-19, after the user-reported 23:00 KST Routine filter change.

This is a **read-only, no-deploy** test to verify that the externally configured Claude **PR-opened** Routine accepts a new `review/*` branch after the former `experiment/ai-collab-*` head filter was reportedly removed. It is not a test of production release or writer privileges.

## Trigger input
- Repository: `mauveplace/jjooni-control-tower`
- Pull request title includes `[AI-COLLAB]`
- Base: `main`
- Head: `review/roy-pilot-route-smoke-20261119` (must not be rejected by branch prefix)
- One newly changed task file: `ai-collab-dispatch/tasks/D-261119-ROY-PILOT-ROUTE-056.json`
- `required_reviewers` contains `ROY`, mode `SYSTEM_REVIEW_ONLY`

## Distinguish outcomes

1. **TRIGGERED:** first-party Claude run metadata shows a `pull_request.opened` invocation for this specific new PR.
2. **ACKED:** ROY actually starts a Claude session and authenticates target PR ID and full current HEAD SHA from GitHub.
3. **REVIEWED:** ROY independently inspects PR diff and main collaboration contract; leaves ONE comment on this PR with marker `JJOONI-COLLAB-V4`, exact HEAD, `ROY_PILOT_TRIGGER=PASS|NEEDS_CHANGES|BLOCKED`, original event/session provenance. A repository-owner comment marker on its own does not prove automatic execution.
4. **CLOSED LOOP:** a real ChatGPT Work event or independently observed scheduled follow-up receives that exact ROY comment ID without manual user relay; no claim of real-time webhook if discovered by polling. The JJOONI record distinguishes `AUTO_EVENT`, `HOURLY_POLL` and `MANUAL`.
5. **DEDUPED:** no duplicate review for identical `task_id + full HEAD + stage`. No code modification, main merge, deploy, write access extension, trading or charges.

If Claude quits silently, report `TRIGGERED_BUT_SKIPPED` only with run metadata; otherwise `RUN_UNVERIFIED`. Do not assume invocation succeeded because the PR exists.

## Scope and constraints

This PR changes only this documentation and one task JSON. It must remain open until the smoke result is independently evidenced and recorded. All system changes must be in a separately approved PR. `ROY_WRITER_POLICY.md` is not enabled by this PR; #333 V1 must not be merged just to make this smoke pass.
