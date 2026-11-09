# JJOONI-first, ROY-on-demand operating policy (V5 proposal)

**Status: PROPOSED (not effective until main merge with owner approval).**
**Goal:** complete routine coding, debugging, testing, incident triage and documentation in JJOONI/ChatGPT Work without spending scarce Claude/ROY runs. ROY is an independent challenge resource, not the default implementation engine.

## Responsibilities and execution

| Class | Default first pass | ROY involvement | Release gate |
| --- | --- | --- | --- |
| UI, backend, scripts, workflow fixes, unit tests, docs | JJOONI owns implementation and regression evidence | NONE by default | CI + observed production checks + owner permission |
| Operational failures (Gmail Actions alerts, freshness, Pages) | JJOONI owns root-cause, PR, test and verification | Only if repeated unresolved root-cause or technical challenge explicitly requested | Same production/owner gates |
| Security, identity, permissions or credentials | JJOONI drafts a minimal, least-privilege patch | **Independent review required**, once for the final relevant HEAD | Owner approval; no broad tokens |
| Market/account data integrity and trading strategy logic | JJOONI investigates, prepares code and tests | **Independent review required** for consequential changes | Independent evidence plus explicit owner approval; no trading |
| A user directly asks ROY to handle a task | ROY may intake/read-only analyze it | Conserve ROY capacity; transfer substantive code work to JJOONI unless owner explicitly directs otherwise | Origin never grants release permission |

## Cost-aware event protocol

1. **Default development:** JJOONI makes a normal branch/PR titled `[JJOONI-DEV]` or `fix(...)` **without** the `[AI-COLLAB]` opt-in and without a ROY task JSON. The owner-directed JJOONI development session is the executor. Test/CI/merge gates remain intact.
2. **ROY is not automatically summoned:** do not create an `[AI-COLLAB]` PR or `[AI-COLLAB][ROY-REQUEST]` issue merely for routine development, a repeated PR head, an hourly scan, or a GitHub failure email. The JJOONI monitor should pick up these issues without invoking Claude.
3. **Independent challenge:** when risk is genuinely consequential (security, identity, fund/account calculations, trading logic, or explicit owner request), JJOONI finishes code and regression checks first, then creates **one** uniquely pinned, owner-authorized review request for the current full HEAD. No duplicate ROY request while a review is pending, and no review merely because a comment arrived.
4. **Low remaining ROY quota:** report the unverified capacity or observed rate-limit precisely. Continue JJOONI-only preparation and tests. If independent review is required but ROY cannot run, mark `AWAITING_INDEPENDENT_REVIEW`, not PASS/APPROVED. Do not burn repeated Claude sessions or invoke paid model APIs without owner permission.
5. **Rework:** JJOONI implements ROY's actionable findings and runs CI. One follow-up independent review is requested only if a changed security/financial decision needs a fresh challenge. ROY must never be tasked with repetitive coding/push/PR creation as a workaround for the current 403 fork-token limitation.
6. **Audit:** record GitHub PR URL, branch, full HEAD, CI run IDs, Work/Claude provenance when available, final release approval and latest live data. A green workflow or an event delivery alone is not deployment success or proof of an AI review.

## Implementation and transport boundaries

- `ai-collab/capacity_router.py` is a **non-executing** policy helper. All `work_type` values prefer JJOONI; ROY fallback is disabled unless a trusted runtime separately verifies the owner's explicit delegation. Even authorized ROY fallback is **READ_ONLY_PREPARATION** and never merge/deploy permission.
- `strategy_analysis`, `data_integrity`, `security_review` always require independent review. Ordinary code/docs/tests do not automatically require a ROY call. `required_independent_review=True` can add a requirement, but `False` cannot waive high-assurance risk.
- `origin=USER_TO_ROY` no longer forces first-pass ROY development. This saves ROY quota without dropping the user's request. It must not silently delegate a user's specifically ROY-only request; explicit constraints take priority.
- All existing V4 `[AI-COLLAB]` jobs remain opt-in and valid for tasks that actually need ROY. Their required task diff, provenance, event dedupe and no-self-review requirements still apply. The general `[JJOONI-DEV]` track is **not** a V4 dual-agent task; it must not fake independent review evidence.
- Existing ROY fork account/token is for the manual diagnostic and future separately approved fork-only work only. A fork-only token receiving HTTP 403 on the original repository's PR creation is not fixed by broadening the repository default `GITHUB_TOKEN` permission. Do not toggle repository-wide `Read and write permissions`, change main protection, invite bot as upstream writer, or copy a token into PRs.
- The ChatGPT GitHub connection currently authenticates as `mauveplace`; GitHub comments from that account alone do not prove which AI authored them. ROY provenance requires independently correlated Claude run evidence.
- A GitHub PR/code change does not update Claude Routine or ChatGPT Work event subscriptions. Their external filters must be audited separately; if an `issue.opened` Claude Routine cannot filter the title before launch, it could cost a run on unrelated issues. Disable that broad trigger in Claude or keep issue creation rare until proven filtered.

## Definition of done

- [ ] Normal low-risk JJOONI PR created; CI passes; no unexpected ROY run observed.
- [ ] JJOONI owns ordinary failure triage and coding in Work; dedupe avoids duplicate PRs.
- [ ] One explicit high-assurance opt-in PR produces one authenticated ROY independent review; no review loop.
- [ ] No secret leak, no main push/merge without owner consent, no account or broker data exposed.
- [ ] Actual deployment/data freshness separately verified after any approved production release.

**Truth boundary:** this file and the router change are not themselves an AI executor, event subscription or Claude billing control. Those require independent connected-product checks.
