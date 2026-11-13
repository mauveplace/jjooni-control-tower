# L1 — ROY review → JJOONI Work webhook auto-handoff (read-only verification)

## Scope and acceptance

This is an **isolated public-data verification document**. The PR containing it must never be merged or deployed solely because one AI says PASS. It introduces no executable code or production change. Task contract is `ai-collab-dispatch/tasks/D-261113-L1-WEBHOOK-HANDOFF-031.json`.

**Hypothesis:** A genuine independently reviewed ROY PR Conversation comment on the exact current HEAD can start the *existing* ChatGPT Work `JJOONI ↔ ROY GitHub 웹훅` task and cause JJOONI, without a human prompt, to post one `stage=ROY_REVIEW_RECEIVED` receipt with the exact source comment ID and HEAD.

**L0 precondition (previously measured; not claimed as proof of L1):**
- Source PR #323 new comment ID `6842687765` at 2026-11-13 03:13:10 UTC carried `JJOONI-L0-TEST`.
- A separate, newly configured event-based ChatGPT Work task `JJOONI GitHub 즉시수신 L0 테스트` generated GitHub issue-comment receipt `6842701166` at 03:14:03 UTC, exact body `JJOONI_L0_RECEIVED / 6842687765 / issue_comment.created`.
- GitHub PR #323 timeline contained one such matching receipt at verification time. This proves an event-triggered model/GitHub response path from a comment posted by the `chatgpt-codex-connector` GitHub app, **not atomic exactly-once** or receipt from a different actor such as the Claude GitHub app.
- The existing older Work webhook independently completed a later execution after the receipt, but had **not** produced an automatically confirmed ROY review intake.
- Both assistant agents have sometimes posted through shared GitHub owner `mauveplace`. The original GitHub `performed_via_github_app.slug` field is a useful additional, non-circular discriminator (e.g. `claude` versus `chatgpt-codex-connector`), but the shared login, marker, app slug, and claimed Claude session link together still cannot *completely authenticate* first-party Claude execution.

## L1 sequence

1. JJOONI creates a new opt-in PR with this document and **exactly one added task contract JSON**. Branch uses the known `experiment/ai-collab-` prefix recognized by Claude's `pull_request.opened` ROY Pilot Review Routine. This PR creation is the actual *potential* Claude trigger.
2. ROY, **if actually started by its first-party PR-opened webhook**, independently reads this PR's changed files and tests the architecture claims against GitHub original comments, current full PR HEAD and task JSON. It may post **one original PR conversation review comment** with:
   - First line: `<!-- JJOONI-COLLAB-ROY-REVIEW-V4 task=D-261113-L1-WEBHOOK-HANDOFF-031 head=<actual-full-40-character-sha> stage=SYSTEM_REVIEW_ONLY source-issue=330 -->`
   - Body line: `ROY_REVIEW=PASS`, `ROY_REVIEW=NEEDS_CHANGES`, or `ROY_REVIEW=BLOCKED`; evidence-backed findings, original PR number and actual Claude first-party session context if available. Review verdict applies to this **document only**, not the Work delivery path.
   - No edits, extra PRs/issues, artificial Work receipt, merge/deploy or access to private user/account data.
3. Existing **original** ChatGPT Work GitHub event task (not the L0 task) receives that actual new PR comment, re-fetches the PR current HEAD, source comment ID and diff task contract, classifies review as a candidate, and writes **one** `<!-- JJOONI-COLLAB-STATUS-V1 stage=ROY_REVIEW_RECEIVED source_comment_id=<source-id> head=<actual-sha> -->` GitHub PR Conversation comment clearly identifying `ROY_UNVERIFIED` if first-party Claude provenance is not independently verifiable.
4. JJOONI compares independent first-party Work task execution with the two *actual* GitHub comments and their timestamps, and checks duplicates. An ordinary chat-origin `MANUAL_CHAT_POST`, a scheduler snapshot, the L0 task receipt, or a ROY comment without follow-up **does not** satisfy the L1 acceptance.

## Measured first L1 attempt — event read PASS, auto-ack WRITE NOT DONE

- PR #422 opened on first exact HEAD `3c432676b7a274650fcbfdd9f41c2db8476a0cd0` at 2026-11-13 03:19:03 UTC. Its `pull_request.opened` event was automatically received by the original Work task; [JJOONI PR-opened ACK 6842787707](https://github.com/mauveplace/jjooni-control-tower/pull/422#issuecomment-6842787707) was posted at 03:19:49 UTC.
- A genuine new ROY [review comment 6842802488](https://github.com/mauveplace/jjooni-control-tower/pull/422#issuecomment-6842802488) appeared at 03:20:47 UTC on that exact HEAD. Original GitHub record identifies `performed_via_github_app.slug=claude`. The review declared `ROY_REVIEW=PASS` for **documentation consistency only**, not L1.
- The existing JJOONI Work event task automatically ran on an `issue_comment.created` event (run `116c65db-0d00-832c-bda5-547825d634c0`; started 03:21:13 UTC; completed 03:21:48 UTC). It re-fetched the original comment, verified task ID, exact HEAD, and successful CI; it labelled provenance `ROY_UNVERIFIED`. Its result said it was "confirmation only" and **did not post** a `stage=ROY_REVIEW_RECEIVED` GitHub comment. Therefore: **event delivery and model reading succeeded, but full L1 automatic ACK did not**.
- This is not a platform trigger problem for this event family. The original Work task's saved prompt has been updated after the first attempt to make receipt-writing mandatory even with `ROY_UNVERIFIED`, while still prohibiting code/merge/deploy/trade and maintaining evidence-based safe deduplication.
- A single distinct ROY re-review **on a materially updated HEAD** is permitted within the two-review cap to test the corrected route. No synthetic ROY reply or retrospective event replay may be treated as a fresh webhook.

## L1 audit clock, provenance, and duplicate accounting

- Count from authentic ROY source comment `created_at`: target Work trigger starting within **2 minutes** and GitHub auto-receipt created within **5 minutes**. Missing receipt at 5 minutes is `L1_TIMELY_FAIL`; if receipt arrives after that, note `L1_LATE_RECOVERED` rather than rewriting the original failure.
- For each candidate record original review `id`, `created_at`, `performed_via_github_app.slug`, PR number, full current HEAD, Work run ID/start/finish, and receipt `id`, `created_at`, `performed_via_github_app.slug`. GitHub app slug is corroborating evidence, not complete agent authentication.
- Exactly one receipt keyed to the original **source comment ID + HEAD + `issue_comment.created`** passes idempotency observation. Two or more matching receipts yield `L1_FAIL_DUPLICATE`; absence yields `L1_FAIL_NO_WRITE`. A single observed receipt does **not** guarantee atomic exactly-once under concurrency.
- Do not count PR-opened ACK, L0 ACK, any manual chat-origin note or the ROY document PASS as L1 automatic intake.

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
