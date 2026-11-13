# L1 — ROY review → JJOONI Work webhook auto-handoff (read-only verification)

## Scope and acceptance

This is an **isolated public-data verification document**. The PR containing it must never be merged or deployed solely because one AI says PASS. It introduces no executable code or production change. Task contract is `ai-collab-dispatch/tasks/D-261113-L1-WEBHOOK-HANDOFF-031.json`.

**Hypothesis:** A genuine independently reviewed ROY PR Conversation comment on the exact current HEAD can start the *existing* ChatGPT Work `JJOONI ↔ ROY GitHub 웹훅` task and cause JJOONI, without a human prompt, to post one `stage=ROY_REVIEW_RECEIVED` receipt with the exact source comment ID and HEAD.

**L0 precondition (previously measured; not claimed as proof of L1):**
- Source PR #323 new comment ID `6842687765` at 2026-11-13 03:13:10 UTC carried `JJOONI-L0-TEST`.
- A separate, newly configured event-based ChatGPT Work task `JJOONI GitHub 즉시수신 L0 테스트` generated GitHub issue-comment receipt `6842701166` at 03:14:03 UTC, exact body `JJOONI_L0_RECEIVED / 6842687765 / issue_comment.created`.
- GitHub PR #323 timeline contained one such matching receipt at verification time. This proves an event-triggered model/GitHub response path, **not atomic exactly-once** or ROY source authentication.
- The existing older Work webhook independently completed a later execution after the receipt, but had **not** produced an automatically confirmed ROY review intake.
- Both assistant agents have sometimes posted through shared GitHub owner `mauveplace`; this login or a comment marker alone cannot prove which agent authored a review.

## L1 sequence

1. JJOONI creates a new opt-in PR with this document and **exactly one modified task contract JSON**. Branch uses the known `experiment/ai-collab-` prefix recognized by Claude's `pull_request.opened` ROY Pilot Review Routine. This PR creation is the actual *potential* Claude trigger.
2. ROY, **if actually started by its first-party PR-opened webhook**, independently reads this PR's changed files and tests the architecture claims against GitHub original comments, current full PR HEAD and task JSON. It may post **one original PR conversation review comment** with:
   - First line: `<!-- JJOONI-COLLAB-ROY-REVIEW-V4 task=D-261113-L1-WEBHOOK-HANDOFF-031 head=<actual-full-40-character-sha> stage=SYSTEM_REVIEW_ONLY source-issue=330 -->`
   - Body line: `ROY_REVIEW=PASS`, `ROY_REVIEW=NEEDS_CHANGES`, or `ROY_REVIEW=BLOCKED`; evidence-backed findings, original PR number and actual Claude first-party session context if available. Review verdict applies to this **document only**, not the Work delivery path.
   - No edits, extra PRs/issues, artificial Work receipt, merge/deploy or access to private user/account data.
3. Existing **original** ChatGPT Work GitHub event task (not the L0 task) receives that actual new PR comment, re-fetches the PR current HEAD, source comment ID and diff task contract, classifies review as a candidate, and writes **one** `<!-- JJOONI-COLLAB-STATUS-V1 stage=ROY_REVIEW_RECEIVED source_comment_id=<source-id> head=<actual-sha> -->` GitHub PR Conversation comment clearly identifying `ROY_UNVERIFIED` if first-party Claude provenance is not independently verifiable.
4. JJOONI compares independent first-party Work task execution with the two *actual* GitHub comments and their timestamps, and checks duplicates. An ordinary chat-origin `MANUAL_CHAT_POST`, a scheduler snapshot, the L0 task receipt, or a ROY comment without follow-up **does not** satisfy the L1 acceptance.

## Fail-closed rules

- L1 PASS requires authentic new ROY review source **and** Work-initiated JJOONI PR receipt linked to that source ID and exact current HEAD; a `no_update` run is not proof of a successful intake.
- Don't infer an authenticated ROY from shared account, marker, GitHub PR author, a claimed session URL, or Work run timestamp alone. Record provenance evidence limitations.
- No task edits to either agent's external event subscription or permissions by this PR. No source code or investment changes, no extra paid infrastructure, no main merge/deploy. Release gate `USER_APPROVAL_REQUIRED`.
- Existing polling backup is a separate slower fallback and is not L1 PASS.
- Avoid unbounded retry/recursive bot comments and multiple independent ROY reviews for the same exact HEAD.

## References (GitHub first-party source evidence)

- [L0 original PR comment](https://github.com/mauveplace/jjooni-control-tower/pull/323#issuecomment-6842687765)
- [L0 automated response](https://github.com/mauveplace/jjooni-control-tower/pull/323#issuecomment-6842701166)
- [Collaborative incident/progress record](https://github.com/mauveplace/jjooni-control-tower/issues/330#issuecomment-6842726586)
