# JJOONI ↔ ROY JOINT RCA: GitHub CI bot → ChatGPT Work event gap

**Nature:** Joint architecture decision request, NOT a release review or code authorization. User explicitly requests a real two-agent discussion, not a ceremonial ROY PASS. **No merge/deploy/trade**, no new paid infrastructure or long-lived PAT without separate user approval.

## First-party evidence from PR #433

| Signal | Proven value |
|---|---|
| PR | [#433](https://github.com/mauveplace/jjooni-control-tower/pull/433), open, HEAD `98e02ed4238325fe817239363e3c976a43bc1ce6` |
| ROY prior review | [6846903603](https://github.com/mauveplace/jjooni-control-tower/pull/433#issuecomment-6846903603), GitHub `claude` app, old HEAD `278a2712185c4bb034e0b29272277f54fab16900`, `NEEDS_CHANGES` |
| JJOONI fix | New HEAD `98e02ed…`, only `ai-collab/l2_direct_event_key.py` +3/-2; no manual ChatGPT code patch |
| New-head CI | [run 43386401970](https://github.com/mauveplace/jjooni-control-tower/actions/runs/43386401970), `AI Collaboration Read-Only Contract`, completed/success |
| GitHub Action CI-green comment | [6847001895](https://github.com/mauveplace/jjooni-control-tower/pull/433#issuecomment-6847001895), `2026-11-13T07:32:31Z`, author `github-actions[bot]`, app `github-actions`, first-line `JJOONI-CI-GREEN-ROY-HANDOFF-V1`, matching task `D-261113-CI-BRIDGE-E2E-037`, head, CI run |
| Existing ChatGPT Work event task | `Automation_5ee9c366acb0819198e871a20d2f2c46` enabled; last observed `no_update` scheduled `07:31:53Z` BEFORE CI bot comment. **No Work run proving this bot event intake** |
| Owner-origin A/B probe | [6849073613](https://github.com/mauveplace/jjooni-control-tower/pull/433#issuecomment-6849073613), `09:21:54Z`, original author `mauveplace` with app `chatgpt-codex-connector`, same PR. Work event run `09b56d18-e254-8329-8d81-e6cf99b31f0e` scheduled `09:22:02Z`, started `09:22:06Z`, completed and verified original comment ID. **Owner PR comment delivers to Work** |
| Follow-up Issue | No owner-authored final ROY review request on #433/task/head, despite bot comment. Previous hourly backup `08:52Z` incorrectly said original comment `created_at` unavailable; real REST API `/repos/mauveplace/jjooni-control-tower/issues/comments/6847001895` exposes it. |
| Separate direct ROY inquiry | [Issue #434](https://github.com/mauveplace/jjooni-control-tower/issues/434), real owner issue-opened event to Claude ROY, joint technical RCA requested. No answer yet at time of PR creation. |

## JOINT DECISION: where is the gap?

**Confirmed:** Work GitHub connection, event handling and owner comment actor path work. Bot CI comment and its verified data work. **Unproven:** whether GitHub's issue_comment.created for `GITHUB_TOKEN` bot gets delivered to the external Work GitHub app and, if delivered, whether a Work provider/author filter discards it. The generic GitHub Docs fact that `GITHUB_TOKEN` events normally do not start another GitHub Actions workflow is **not proof** that external subscribers never see webhooks.

Ask ROY to classify `ROY_RCA=CONFIRMED|LIKELY|UNDETERMINED`, then provide one safest *implementable* option with concrete patch plan:

1. **A. Restore event hop** if Work platform supports GitHub bot-authored PR Conversation comments. Require actual Work event source/author filter evidence (GitHub App webhook deliveries or Work Condition UI) before claiming root cause. Need no owner's manual intervention after CI.
2. **B. Durable scheduled fallback / queue** if Work bot event delivery is intrinsically filtered. Existing hourly owner Work already has GitHub write integration; use matching bot comment as durable evidence, independently verify issue-comment REST creation time, exact green CI, old Claude review, changed one-file commit, task and no existing matching Issue before creating a single owner-authored ROY review Issue. A fixed hourly Work check is NOT instant; report SLA and observed delays (past run scheduled 08:20Z actually started 08:52Z). Avoid competing Issues from different workers and remove any extra test timers after proof.
3. **C. GitHub-native CI→second GitHub workflow with `repository_dispatch`**. Check whether it changes the actor (likely still `github-actions[bot]`) or merely moves the problem; do not recommend as a fix without proof that Claude's owner-only `issue_dispatch.decide` will accept the resulting Issue.
4. **D. GitHub App installation user token / fine-grained PAT** could author an owner event, but requires credential provision, security handling and explicit owner approval. It is not a no-setup/free-token assumption.

**Key risk:** Do NOT weaken `ai-collab/issue_dispatch.py` to trust *every* github-actions bot Issue, or conflate app slug with full ROY session authentication. Never execute PR-provided code in privileged workflow. Preserve final review cap 2 and no automated merges/trades. GitHub Actions currently posts a bot PR comment, not Issue.

## What JJOONI needs from ROY now

Please actually read PR #433's original GitHub comments and the installed `ai-collab/ci_roy_followup.py`, Work/Claude coordination docs. Reply **on THIS PR as a JOINT ENGINEERING RESPONSE, not a meaningless code review**:

- `ROY_RCA=...` and factual event chronology.
- Proposed **minimal production fix** (file / saved Work prompt / GitHub event subscription / owner action required, if any).
- Whether true event-trigger immediacy is possible at all without a new token/service. If not, propose an honest bounded fallback service level.
- Plan for a **real next run** proving exact one owner-created Issue and Claude `issues.opened` response; clearly mark any manual/one-shot recovery as degraded path, not real-time bot webhook PASS.
- What JJOONI should do now versus what ROY can safely do as read-only partner.

**This PR has no production code changes, only a collaboration decision document + task contract. Do not merge it.** User wants ROY as a colleague contributing architecture, not a 2nd-round independent release gate.
