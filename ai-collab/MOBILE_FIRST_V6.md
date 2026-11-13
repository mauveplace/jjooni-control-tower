# Mobile-first review loop V6 — proposal (PC/CLI not required for owner)

**Scope:** JJOONI ↔ ROY engineering collaboration in `mauveplace/jjooni-control-tower`. This is an incremental operating procedure, **not** a replacement for the V4/V5.1 authorization, review provenance or release contract. It takes effect only when its PR is approved and merged. No Observatory data collection, investment/trading rules, secrets, billing, cloud infrastructure or GitHub app permissions are changed.

## Owner experience: one chat, not a terminal

The owner can request work from ChatGPT or Claude on a phone/tablet. The initiating agent handles GitHub branches, task files, pull requests, tests and review requests using already connected tools. Never require the owner to install Node, Python, Codex CLI, Claude Code CLI, a bridge server, or to paste credentials. If an external Routine or ChatGPT Work subscription must be configured and cannot be updated with existing connected tools, state the one-time product-side limitation explicitly; do not claim a GitHub commit activated it.

The existing public PR dashboard is `ai-collab/status.html` (open it through a published site if available; source itself does not prove live publication). User sees three concise states:
- **개발 중**: JJOONI patch, tests, source evidence.
- **로이 검토 대기/수정 중**: precise current HEAD, request and actual review source.
- **승인 대기/차단**: current-head findings, CI and production verification, owner merge approval.

Never infer that a ROY Routine is running from an issue's existence or an AI-marked GitHub comment. Work/Claude capacity and event subscription state remain UNKNOWN until first-party evidence.

## Lightweight routing

| Situation | Track | Reviewer |
| --- | --- | --- |
| Minor layout/docs/test fix with no consequential policy or data impact | `[JJOONI-DEV]` | JJOONI tests/CI; ROY not auto-invoked |
| Significant architectural change or recurring uncertain failure | `[AI-COLLAB]` | ROY does one evidence-backed read-only challenge |
| Security, market/account data integrity or investment strategy logic | `[AI-COLLAB]` | ROY independent review required; no bypass |
| Owner explicitly asks ROY to lead | Existing verified USER_TO_ROY path | JJOONI independent reviewer; no self-review |

For dual-agent work create **exactly one PR-diff task JSON**, keep `[AI-COLLAB]` + base `main` and do not turn comments into unbounded event loops. ROY PR-opened and Issue-opened follow-up Routines have separate triggers. Use only observed supported events.

## Review budget: default two independent reviews total

The owner-facing shorthand “two rounds” limits wasteful repeated prompts; it is **not an auto-approval threshold**.

1. JJOONI implements, runs the appropriate CI/tests, and opens one properly scoped PR. One ROY review is requested only when justified by the table above.
2. ROY returns evidence with current 40-character HEAD, actual first-party session provenance and PASS / NEEDS_CHANGES / BLOCKED.
3. On NEEDS_CHANGES, JJOONI fixes findings first. Do **not** request a second ROY run on an unchanged tree, formatting-only commit, duplicate issue, or event retry.
4. If relevant code/decision materially changed, allow **one** targeted follow-up review via the existing Issue-opened Routine, with current PR HEAD, only after checking if a review already exists. If no verified ROY event fires, show WAITING_EVENT rather than claiming success.
5. If the second review still finds material defects, **ESCALATE_TO_OWNER** and stop automatic re-requesting. In particular, blockers must remain BLOCKED and never turn into a PASS merely because the budget is exhausted.
6. A claimed PASS is not authenticated ROY provenance. Independently check the session/event; run CI, production/data freshness checks where applicable; and secure owner approval for any merge or deploy. No automatic trades.

The helper `ai-collab/mobile_review_loop.py` produces a **non-executing recommendation** from verified inputs. It is not a webhook, not the actual AI dispatcher and not a review authenticator. The initiator uses its decision as an additional guard. Existing `capacity_router.py` and `event_gate.py` remain authoritative for capacity and event validation.

## PR body: one compact log instead of a new file per review

Use this concise PR body structure rather than creating `PLAN.md` and `PLAN-REVIEW-LOG.md` for each small task:

```markdown
### Plan / acceptance
- What is changing and why (1-3 sentences)
- Non-goals and safety boundaries
- Reproduction + objective success test

### JJOONI implementation
- Changed files, exact HEAD, tests and CI evidence

### ROY challenge (if required)
- ROY session provenance, exact HEAD, verdict, actionable findings
- Fixes and second review (only if material), otherwise N/A

### Owner decision
- READY / BLOCKED / WAITING_EVENT
- CI evidence; production and freshness verification distinct
- Merge/deploy owner approval: NOT YET / LINK TO AUTHORIZED APPROVAL
```

## Duplicate request and budget guards

- Deduplicate by repo + PR + task + material tree HEAD + review stage; never count a no-op rebase or re-delivery as a new review.
- Reject role-spoofed markers; only first-party Claude/Work session evidence establishes actor provenance. Never treat an ordinary owner GitHub comment as a verified ROY run.
- Existing follow-up routine is read-only; a review request in a GitHub issue is not permission to commit or merge.
- The same GitHub Issue-opened event can wake a model even if its prompt exits early. Do not create generic probe issues or continuous polls to test quota.
- Do not change ROY fork writer permissions, branch rules, secrets or the unmerged separate ROY writer policy PR.
- No new 5-minute polling. Fetch a dashboard only on view/refresh; keep any existing user-authorized one-hour monitoring separate from this decision aid.

## Acceptance / before operational promotion

1. Existing `ai-collab-contract.yml` runs unit tests including `ai-collab/tests/test_mobile_review_loop.py` via test discovery; inspect actual CI.
2. Normal low-risk test -> `JJOONI_TESTS_ONLY`; substantial/repeated or mandatory type -> `REQUEST_ROY`.
3. Unverified PASS -> `VERIFY_ROY_SOURCE`; same-head NEEDS_CHANGES -> `JJOONI_FIX_FIRST`; after round 2 -> `ESCALATE_TO_OWNER`; critical defect -> `BLOCKED_REQUIRES_FIX`.
4. For this PR, verify one genuine PR-opened Claude run and one ROY review for exact current HEAD, then incorporate relevant feedback **without automatically merging**.
5. During future live work, measure AI runs, duplicate review requests, code-to-PR elapsed time, and post-deploy failure counts across 3 real tasks. No fabricated efficiency percentage.

**Explicit limitation:** neither this document nor helper changes Claude or Work account-side event subscriptions. The existing Work repository-wide event receipt remains unverified until a separate first-party test proves it.

## Operational recovery (separate from this helper)

As of 2026-11-13 the existing hourly JJOONI review-follow-up task was rewritten to scan recently changed open collaboration PRs rather than repeat a fixed PR #410. This is an external account automation, **not** functionality installed by this PR; its live execution, access and review-loop result must be independently observed. Treat any `[AI-COLLAB]` PR missing exactly one changed active task JSON (e.g. incident #414) as `BLOCKED_CONTRACT`, not as silently successful. Never infer `ROY` identity or a delivery from a shared `mauveplace` marker. Only a verified genuine new PR event or configured issue-opened follow-up can start the respective Claude Routine; comments on an existing PR cannot replay PR-opened.
