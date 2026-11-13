# CI-green → GitHub bot receipt → JJOONI Work owner issue → ROY (opt-in)

## Why this is a two-hop bridge

A `pull_request.synchronize` event fires **before** GitHub CI completes. A Work event handler can legitimately read `CI_PENDING`, and might never get another event specifically when CI turns green. The user's isolated [PR #430](https://github.com/mauveplace/jjooni-control-tower/pull/430) demonstrated a genuine ROY comment → Work correction → 136 passing CI tests, **but no automatic ROY follow-up Issue**.

Use a trusted GitHub Actions `workflow_run.completed` handler to verify **current-HEAD CI SUCCESS** and record one durable, narrowly scoped `JJOONI-CI-GREEN-ROY-HANDOFF-V1` comment on the target PR. **Do not create the final Issue from GITHUB_TOKEN**: those Issues are authored by `github-actions[bot]`, while the existing Claude `issues.opened` Routine and `ai-collab/issue_dispatch.py` trust only owner-created review Issues. Token-created Issues also have platform-specific downstream-event limitations.

The existing **owner-authorized JJOONI Work GitHub event task** must independently receive that new bot PR comment, revalidate GitHub original comment + successful exact-HEAD CI + task + real Claude review, and create **one owner-authored** read-only ROY review Issue. The established Claude `issues.opened` Routine then independently reviews the exact new HEAD.

## Hard security boundaries

1. Privileged workflow `.github/workflows/ai-collab-ci-roy-followup.yml` runs only after named `AI Collaboration Read-Only Contract` completed SUCCESS on same-repository `pull_request`; it **checks out trusted main**, never PR-provided code or workflow artifacts. API recheck pins the actual workflow `path=.github/workflows/ai-collab-contract.yml`, name, head repository, event and exact full head SHA.
2. Scope: still-open, main-targeting non-draft `[AI-COLLAB]` PR, head branch `experiment/ai-collab-*`, only `ai-collab/` or `ai-collab-dispatch/` diff, exactly one changed task JSON requiring ROY, `SYSTEM_REVIEW_ONLY` and `USER_APPROVAL_REQUIRED`.
3. **Future tasks opt in** with `"auto_roy_review_after_ci": true` in their task JSON; exact preapproved test PR #430 with `D-261113-L2-CI-DISPATCH-035` is a single migration exception.
4. The correction HEAD must be exactly **one commit** after a genuine GitHub `performed_via_github_app.slug=claude` review marking `ROY_REVIEW=NEEDS_CHANGES` on the direct parent SHA. Exactly one non-test `ai-collab/` source file may change in that corrective commit; no task or regression-test edits in the correction. Maximum two independent ROY reviews; a second prior review blocks repeat requests.
5. Before comment creation, check for an existing **owner-authored** matching ROY review Issue (proper title, first-line issue marker and exact PR/task/SHA/mode/requester) and an earlier `github-actions[bot]` CI-green handoff PR comment for the same PR/task/SHA. Incident Issue #330 mentions the task but must never be misidentified as the actual review Issue. The handoff comment includes GitHub original CI run ID, original ROY review comment ID and SHA for Work validation.
6. Workflow GitHub token is restricted to `contents:read`, `actions:read`, `pull-requests:write`, `issues:read`. The **only GitHub write is one public PR CI-green handoff comment**, not Issues, source code, merge, release, deploy, permissions, trading or secrets. Same-SHA GitHub workflow concurrency serializes retries. Search/dedupe is best effort, not an atomic exactly-once guarantee across different providers.
7. Work must check the original triggering PR comment, not a quoted marker: `issue_comment.created`, repo, PR, source original comment ID and actor `github-actions[bot]`, exact marker and head, authentic GitHub CI run `completed/success` on current HEAD with expected workflow path/name/event/repo. It must compare one actual previous Claude-app ROY review before creating **a single Issue** with first line `<!-- JJOONI-COLLAB-ISSUE-V1 -->`, `Target-PR`, `Task-ID`, `Expected-HEAD`, `Mode: SYSTEM_REVIEW_ONLY`, `Requested-By: JJOONI`, `Scope`. It must verify the new Issue is **owner-authored** and not merge/deploy.
8. The existing scheduled recovery task may reconcile a missing owner Issue only after a separately verifiable delay, exact green CI and current HEAD. It cannot assert it was an immediate webhook. Before permitting overlapping writers, accept duplicate-risk limits or make the second task read-only; neither an old bot comment nor a Work summary alone is an Issue-creation receipt.

## Evidence, rollout and first-party acceptance

- [PR #430](https://github.com/mauveplace/jjooni-control-tower/pull/430) has corrected SHA `cb7633b1d869b39cb9ff5833dcdace9e0283950e`, [CI #43381251287](https://github.com/mauveplace/jjooni-control-tower/actions/runs/43381251287) SUCCESS, but no original automatic final ROY Issue yet. Merging this workflow **does not retroactively emit old CI events**.
- Unit tests include spoofed/foreign actor, wrong workflow path/repository, no owner opt-in, stale SHA, parent review budget, unsafe source/test edits, dedupe, bot-comment actor and **the existing owner-only `issue_dispatch.decide` receiver contract**.
- To call production operational: (a) independent ROY review of this PR at current SHA returns code PASS; (b) both GitHub contract/architecture checks green; (c) this PR merged with explicit user-approved scope; (d) saved JJOONI Work event prompt updated to handle the bot CI marker; (e) one genuine NEW successful CI event creates the bot handoff comment; (f) Work creates an **owner-authored** ROY Issue exactly once; (g) Claude issues.opened Routine posts one independent exact-HEAD final review. Before (e)-(g), mark **DEPLOYED_UNPROVEN**, not full automatic PASS.
- Existing Work/backup code fix permissions remain restricted; do not broaden them to general PRs. Keep rollback: disable this single GitHub workflow and revert Work prompt if unexpected issues/loops or permissions failures occur; preserve incident record.
- No new paid infrastructure or broad scheduling. Release of real code continues to require user approval; ROY review PASS is never authorization for merge/deploy or trading.

## Previous test record

- [L0/L1/L2 incident record](https://github.com/mauveplace/jjooni-control-tower/issues/330)
- [Original ROY comment PR #430](https://github.com/mauveplace/jjooni-control-tower/pull/430#issuecomment-6846259128)
- [One-file Work fix](https://github.com/mauveplace/jjooni-control-tower/commit/cb7633b1d869b39cb9ff5833dcdace9e0283950e)
