# JJOONI × ROY balanced collaboration policy (V5.1)

**Status: ACTIVE — user-approved PR #338 merged into `main` on 2026-11-09 (commit `ad095142d95ca82c5607392e3c71ce6edf96694e`).** The policy applies to collaboration routing and documentation; Claude and Work external event subscriptions have not been changed by this merge.
**Goal:** make JJOONI the primary developer while using ROY meaningfully as a specialist reviewer, architecture partner, incident challenger and independently owner-directed lead. Think roughly 70:30 by *work contribution*, not as a fabricated measurement of token usage or an enforced call quota. **This is a proposed V5.1 change until merged**; V5 remains the active baseline.

## Responsibilities and execution

| Class | Default first pass | ROY involvement | Release gate |
| --- | --- | --- | --- |
| UI, backend, scripts, workflow fixes, unit tests, docs | JJOONI implements and tests | ROY reviews substantial architectural changes; small fixes skip it | CI + observed production checks + owner permission |
| Operational failures (Gmail Actions alerts, freshness, Pages) | JJOONI diagnoses and implements | ROY independently challenges repeated/unclear root causes rather than every transient failure | Same production/owner gates |
| Security, identity, permissions or credentials | JJOONI drafts a minimal, least-privilege patch | **Independent review required**, once for the final relevant HEAD | Owner approval; no broad tokens |
| Market/account data integrity and trading strategy logic | JJOONI investigates, prepares code and tests | **Independent review required** for consequential changes | Independent evidence plus explicit owner approval; no trading |
| A user directly asks ROY to handle a task | ROY may lead the first pass when **independent owner-origin verification** proves the instruction; JJOONI independently validates | No forced transfer merely because the request arrived through ROY | Origin never grants release permission |

## Cost-aware event protocol

1. **Default development:** JJOONI makes a normal branch/PR titled `[JJOONI-DEV]` or `fix(...)` **without** the `[AI-COLLAB]` opt-in and without a ROY task JSON. The owner-directed JJOONI development session is the executor. Test/CI/merge gates remain intact.
2. **ROY participates at meaningful milestones:** recommend one independent ROY challenge for a substantial feature/architecture revision or repeatedly unresolved bug, and require one for consequential security/identity, portfolio/account-data, investment-strategy changes. Do not summon Claude for minor fixes, every hourly scan, duplicate HEADs, or generic failure-mail noise. Maintain the `[AI-COLLAB]` opt-in for ROY events.
3. **Independent challenge:** JJOONI prepares code and regression evidence first; then, if useful or mandatory, create **one** well-scoped request tied to task ID + the current 40-character HEAD. ROY reports concrete failure modes, missing tests and a verdict. JJOONI implements fixes. A change to the relevant code/security decision may warrant a second targeted review; a comment or no-op rebase does not.
4. **Low remaining ROY quota:** report the unverified capacity or observed rate-limit precisely. Continue JJOONI-only preparation and tests. If independent review is required but ROY cannot run, mark `AWAITING_INDEPENDENT_REVIEW`, not PASS/APPROVED. Do not burn repeated Claude sessions or invoke paid model APIs without owner permission.
5. **Rework:** JJOONI implements ROY's actionable findings and runs CI. One follow-up independent review is requested only if a changed security/financial decision needs a fresh challenge. ROY must never be tasked with repetitive coding/push/PR creation as a workaround for the current 403 fork-token limitation.
6. **Audit:** record GitHub PR URL, branch, full HEAD, CI run IDs, Work/Claude provenance when available, final release approval and latest live data. A green workflow or an event delivery alone is not deployment success or proof of an AI review.

## Implementation and transport boundaries

- `ai-collab/capacity_router.py` is a **non-executing** planning helper. All ordinary work types prefer JJOONI; `complexity=SUBSTANTIVE|CRITICAL` or `repeated_failure=True` produces a ROY review recommendation, not an automatic Claude invocation. A user-directed ROY lead (`owner_verified_roy_lead=True`, `origin=USER_TO_ROY`) or ROY fallback requires separately authenticated owner intent. Router suggestions never grant code writes, merge or deploy.
- `strategy_analysis`, `data_integrity`, `security_review` always require independent review. Ordinary code/docs/tests do not automatically require a ROY call. `required_independent_review=True` can add a requirement, but `False` cannot waive high-assurance risk.
- `origin=USER_TO_ROY` alone is an untrusted PR metadata claim; once verified against actual owner instruction, ROY can be the preferred first-pass lead. If ROY lacks capacity, preserve the work instead of silently substituting JJOONI. Normal ChatGPT-initiated work stays JJOONI-led.
- All existing V4 `[AI-COLLAB]` jobs remain opt-in and valid for tasks that actually need ROY. Their required task diff, provenance, event dedupe and no-self-review requirements still apply. The general `[JJOONI-DEV]` track is **not** a V4 dual-agent task; it must not fake independent review evidence.
- Existing ROY fork account/token is for the manual diagnostic and future separately approved fork-only work only. A fork-only token receiving HTTP 403 on the original repository's PR creation is not fixed by broadening the repository default `GITHUB_TOKEN` permission. Do not toggle repository-wide `Read and write permissions`, change main protection, invite bot as upstream writer, or copy a token into PRs.
- The ChatGPT GitHub connection currently authenticates as `mauveplace`; GitHub comments from that account alone do not prove which AI authored them. ROY provenance requires independently correlated Claude run evidence.
- A GitHub PR/code change does not update Claude Routine or ChatGPT Work event subscriptions. Keep the existing ROY PR-opened and issue-opened Routines; avoid unnecessary generic issues, because a broad `issue.opened` event may consume runs even if the prompt exits early. Do **not** disable ROY collaboration merely to minimize tokens. Verify external trigger behavior from first-party run evidence.

## Definition of done

- [ ] Normal low-risk JJOONI PR created; CI passes; no unexpected ROY run observed.
- [ ] JJOONI owns ordinary failure triage and coding in Work; dedupe avoids duplicate PRs.
- [ ] At least one substantive or high-assurance opted-in task receives a real ROY independent review, and JJOONI acts on any findings; no duplicate loop.
- [ ] No secret leak, no main push/merge without owner consent, no account or broker data exposed.
- [ ] Actual deployment/data freshness separately verified after any approved production release.

**Truth boundary:** this file and the router change are not themselves an AI executor, event subscription or Claude billing control. Those require independent connected-product checks.
