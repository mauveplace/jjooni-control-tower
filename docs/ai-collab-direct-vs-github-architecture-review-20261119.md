# JJOONI ↔ ROY architecture decision review — direct orchestration vs GitHub handoff (2026-11-19)

**Status:** REVIEW PROPOSAL ONLY, not a deployed runtime. Related request: Issue #546. This document deliberately changes no current automations, deployment, subscriptions, secrets, CI, trading, or permissions.

## Decision in scope

The user asked whether the existing collaboration is the Instagram-shared direct GPT-to-Claude-Code/MCP method, or something independently designed, and whether it is *optimal*. This review covers agent invocation and end-to-end task ownership, **not Observatory UI**. The previous Instagram example is understood as GPT issuing a direct request via an MCP-like bridge to Claude Code on a Windows PC, receiving execution results; the original reel is not attached to this PR and exact tool capabilities must not be asserted without verification.

## Current repo-supported facts

- `ai-collab/PROTOCOL.md` V4: JJOONI-primary task/PR, ROY independent review; Claude PR-opened and issue-opened Routines, GitHub comments/Work webhook or hourly polling; task JSON opt-in, exact HEAD and review provenance.
- `ai-collab/ROUTINES.md`: Claude does not expose PR synchronize/comment as event triggers in observed UI; follow-up review normally requires a new issue-opened event. PR/Work full bidirectional E2E not guaranteed from repo settings. Issue/PR creation is a *request*, not evidence of actual Claude invocation.
- `ai-collab/JJOONI_FIRST.md`: balanced work policy; no automatic ROY coding permissions. `ai-collab/ROY_WRITER_POLICY.md` not present on main as checked 2026-11-19; PR #333 is not equivalent to an installed writer privilege.
- Work scheduling and GitHub Actions may be reliable as individual jobs while the *handoff* is not. The Nov 18–19 morning brief `no_update` / 06:30 miss in Issue #530 illustrates that the final artifact ACK, not just scheduler activation, must be the completion signal.
- User has a Windows PC available, but a continuously running PC, official Claude Code command channel, a runnable ChatGPT-to-local-MCP transport, and the user's consent for local permissions are **not** verified.

## Options — ROY must evaluate independently

| Option | How it actually invokes collaborator | Advantages | Failure modes / constraints |
| --- | --- | --- | --- |
| A: direct local execution | A supported, authenticated orchestration interface calls Claude Code on Windows and captures task/run status; integration feasibility MUST be verified | Fast, direct input/output, no PR just to wake collaborator | PC asleep, local agent security, credential storage, process death, uncertain ChatGPT Plus MCP execution support |
| B: existing GitHub-only | PR-opened / issue-opened Claude Routine; GitHub review → Work event or hourly fallback | Provenance and review audit trail, low local maintenance | unsupported follow-up triggers, hidden gaps, duplicated work, manual relay or polling, review-only permissions |
| C: hybrid (proposed) | Documented supported direct command or Routine API *when available* + fallback to existing PR-opened/issue-opened Routine; GitHub PR/CI remains source of truth | Lower handoff latency with auditable, resilient delivery | Added control-plane complexity; authorization, cost and run provenance must be solved |

**Provisional preferred direction: C, staged.** First make B truly closed-loop; then test A as an *optional* acceleration path on a nonproduction task. Do not assume a service or MCP is natively available until a live authorized test proves it.

## Proposed minimal control-plane contract (no implementation in this PR)

1. **Job creation:** durable `job_id, origin, repository, objective, allowed_tools, task_id, pr_number, pinned_head, owner_approval, timeout, budget`, a single writer owner and no same-branch concurrent edits. Default review only.
2. **Dispatch and receipt:** `QUEUED → SENT → ACKED_BY_CLAUDE_SESSION → RUNNING → REVIEW_POSTED → IMPLEMENTED → CI_PASS → RELEASE_AUTHORIZED → DEPLOYED → LIVE_READBACK_VERIFIED → DONE`. A GitHub issue/comment alone is NOT `ACKED`.
3. **Retry and incident ownership:** bounded retry only for transient failure with idempotency key `job_id + actor + task_id + head + stage`; explicit `FAILED/BLOCKED/STALE` for missing authenticity, stale HEAD, no response, rate limit, machine offline, or aborted sessions. No uncontrolled wake loops.
4. **Provenance:** Claude actual run/session reference *separately verified* against the event, GitHub comment ID, and pinned HEAD. Work event identity and live Actions/deployment must also be verified independently; no fake automatic 'PASS'.
5. **Fail closed on privilege:** no production secrets inside issues, no implicit PR writer authorization, no main merge/trading/Cloud resources/fee plans without explicit permission. Local helper restricted to allowlisted repo, read-only first; least privilege short-lived token if later approved.
6. **Follow-up on ROY response:** JJOONI consumes authenticated verdict; `NEEDS_CHANGES` creates exactly one implementation task; commits/tests/current HEAD review are reconciled; `PASS` does not independently authorize deployment.
7. **Human-meaningful DONE:** record actual latest report/page, session dates, published timestamp, GitHub Actions status and live URL readback (or mark UNVERIFIED). Clear distinction between scheduler success and output success.

## Required independent challenge

ROY: Do not rubber-stamp. Rank which current faults stem from unsupported events, Work automation prompt/routing, insufficient rights, and actual cloud execution failures. Identify the single smallest safe improvement that eliminates the highest amount of 'wake but no action' friction **without** building a custom local daemon prematurely. Determine if a direct supported official Claude invocation API is genuinely available to this user, and whether a PC agent would require manual login, a local service, remote tunnel or extra cost. State what cannot be inferred from public repository files.

## Acceptance criteria, mandatory evidence

- **E2E1** new unrelated non-draft opt-in PR with task diff → actual Claude run/session and ROY comment matching full HEAD (not only GitHub author marker).
- **E2E2** ROY `NEEDS_CHANGES` → JJOONI Work actual event receipt with original comment ID → tested patch → independent review only if material HEAD changed; no manual 'please wake' relay.
- **E2E3** identical event replay does not duplicate ROY run, PR, merge, notification or work budget.
- **E2E4** supported PC direct route, if implemented, survives PC sleep/offline with explicit BLOCKED and fallback; no secretly running paid infrastructure or opening inbound public port.
- **E2E5** CI green alone doesn't show DONE: actual deployment commit and HTTPS readback must be checked; service-level reporting independent from agent wake success.
- **E2E6** actual mode/cost/quota, privacy, least privilege and independent owner-authorized writer gate tested.

## ROY response template

`ROY_ARCH_REVIEW=AGREE | AGREE_WITH_CHANGES | DISAGREE | BLOCKED`

Provide: date/time, current PR HEAD, exact sources/readbacks, independent arguments *against* option C, comparison table, P0/P1 minimal action plan, precise E2E test protocol, unverified environment claims, one practical recommendation. Comment once with real Claude source/provenance. The user does not need to act as a relay. No code/deployment under this review PR.
