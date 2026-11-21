# D-261108-AUTOTRIGGER-003 — Claude subscription-based PR event smoke test

**Mode:** SYSTEM_REVIEW_ONLY; PUBLIC_DATA_ONLY; ONE_SHOT; NO_DEPLOY; NO_MODEL_API_KEY; NO_BROKER_ORDERS.

**Purpose:** Determine whether the existing Claude Code Routine on `pull_request.opened` automatically wakes up when a *new draft PR* matching the owner's existing `[AI-COLLAB]` filters is created. This is not a strategy backtest, code repair, or production release.

## ROY instructions (if activated automatically by GitHub PR opened event)

1. Read the triggering PR number and this file from its **PR HEAD**, not `main` and not PR #302.
2. Check the PR's comments; if any existing comment contains the exact marker `<!-- JJOONI-AUTO-TRIGGER-003 actor=ROY -->`, **stop without posting**. Avoid loops.
3. Without modifying files or triggering any workflow, verify PR is a **draft**, base branch is **main**, its changed files are confined to `ai-collab-dispatch/`, and the sole intent is a read-only trigger test.
4. Publish **exactly one** top-level GitHub PR conversation comment whose **first line** is `<!-- JJOONI-AUTO-TRIGGER-003 actor=ROY -->`; title second line `## ROY / AUTO-TRIGGER SMOKE RESULT`. Include actual triggering PR number, PR head SHA, whether GitHub event metadata is available (or UNKNOWN), inspected file path, result PASS/FAIL, and Claude Code session URL if available. Do not claim webhook auto-trigger if this was a manual session.
5. Do **not** change/commit/push/merge/deploy source, create new PRs or branches, or run model APIs; no secrets/account/MAIOS/bank records.

**Success criterion:** One independently verifiable Claude Code comment created on this new PR without the owner pressing Run now. A comment on PR #302 does not count.

**Failure and rollback:** If no Claude comment appears, classify `AUTOTRIGGER_UNVERIFIED` and inspect the Claude Routine's GitHub event filters or its current prompt. Keep this draft PR unmerged. No retries or duplicate creation without owner approval.

**Reference:** Existing pilot PR #302: https://github.com/mauveplace/jjooni-control-tower/pull/302
