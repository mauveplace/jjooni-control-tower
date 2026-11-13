# JJOONI ↔ ROY final operational RCA (2026-11-14)

## Question
User wants real cooperative diagnosis and an operationally workable end state, **not more unverified "instant" success claims**. Review existing confirmed links and root-cause boundaries; no changes to existing production webhook, main, Routines, deploys, trading, secrets or GitHub permissions.

## Actual evidence (first-party links)
| Link | What was verified | What it did NOT prove |
|---|---|---|
| [PR #428](https://github.com/mauveplace/jjooni-control-tower/pull/428#issuecomment-6843721161) | real Claude ROY `NEEDS_CHANGES` comment #6843553381 → genuine Work event run `ed88a26f-3f64-8322-9ca8-aea66ecc7bb2` → a source-only fix commit `639f33b60778d2589df05bd577f9bce535652616` → exact-head CI `43363468654` success → manual owner Issue #429 → second/final ROY PASS #6843659500 | Automatic post-CI owner final-issue dispatch was **manual** in this pilot |
| [PR #431](https://github.com/mauveplace/jjooni-control-tower/pull/431) | trusted-main GitHub workflow after contract CI green can post bot handoff comment; [PR #433](https://github.com/mauveplace/jjooni-control-tower/pull/433) had actual bot comment #6847001895 | bot-authored comment was **not independently verified to awaken Work** |
| [Issue #443](https://github.com/mauveplace/jjooni-control-tower/issues/443) | bot GitHub Action Issue #441 creation succeeded; owner identical-body Issue #442 succeeded; ROY A/B RCA #440 says **both external issues.opened delivery UNVERIFIED** | cannot claim bot actor filtered, GitHub event dropped, or Claude provider quota from no public comment |
| [PR #445](https://github.com/mauveplace/jjooni-control-tower/pull/445#issuecomment-6851483984) | owner created second alias PR of exact original commit SHA; ROY reports distinct first-party `pull_request.opened` trigger and automatic reply | no autonomous owner Work alias after CI proved; extra PR + duplicated ROY run/CI cost |
| [PR #448](https://github.com/mauveplace/jjooni-control-tower/pull/448#issuecomment-6853692489) | genuine Claude-app review ID `6853692489` and true follow-on test Work run `39542d7a-3b38-8331-9d56-72df67aed8ec` | Work rejected real review due strict wrong header marker, therefore no code fix |
| [PR #449](https://github.com/mauveplace/jjooni-control-tower/pull/449) | intended isolated RED canary at head `901faeb782118a64b1ccc4a5ae87dc6c94dd50d6` with failing CI `43430441437`, production Work PR.opened receipt #6853807778; test Work rejected self-origin status comment correctly | as of 2026-11-14 06:51 KST **no ROY first review comment**, hence no R2 Work fix or alias. Cannot infer Claude never received event. |
| [Issue #450](https://github.com/mauveplace/jjooni-control-tower/issues/450) | owner Issue created 2026-11-13T13:07:54Z with exact owner follow-up marker; a new co-RCA comment `@claude` added 2026-11-14 | no proof that @claude mentions work without installed GitHub Action, or that owner Issue caused a Claude Routine session |

## Currently active system (revalidated)
- `JJOONI ↔ ROY GitHub 웹훅`: active event Work receiver, **READ ONLY/STATUS COMMENT ONLY**, cannot patch code or create alias PR; this is an **explicit privilege gate**, not a defect.
- `JJOONI–ROY 협업 대기열 자동 인수·복구`: active HOURLY owner-connected Work fallback; can read trusted main `JJOONI-CI-GREEN-ROY-HANDOFF-V1` marker + exact SHA CI, then create one owner-authored ROY read-only followup Issue. Does not promise instant, has run jitter, and has never been proven to create an Issue on an actual eligible fresh open PR as a full unattended end-to-end test.
- `JJOONI↔ROY L2 자동수정 시험`: temporary event worker ENABLED **for R2 PR #449 and task -044 only**. Strictly test-only single source file. Should be DISABLED once test concluded. Production webhook & fallback are unchanged.

## Engineering diagnosis hypotheses, not asserted facts
- Known fixed internal defect: strict ROY review header parser mismatch on R1 #448; code source fix not run despite Work event.
- Known architectural hole: synchronous Work fixer may finish before new-head CI completes; there is no authenticated additional wake-up for Work to create owner alias after green if bot CI event is suppressed/unknown. Extending same worker with quick poll is not a reliable queue.
- Unverified provider issue: no observable ROY response to PR #449 or Issue #450 (both opened), despite previous first-party Claude Routines working on #428/#445/#448. Need actual first-party Claude Routine trigger history and filters to distinguish throttling/queued/fail/no webhook; Github connector cannot fetch Claude sessions.
- Lower-risk operational path: **don't add duplicate alias PR**. A real first-party ROY comment causes authenticated scoped Work source correction, trusted main GitHub Action attests exact HEAD CI and posts durable bot comment, HOURLY owner Work scans and creates *one* owner-authored ROY final-review Issue (with dedupe), Claude issues.opened does final review if it executes. This is the closest currently implemented chain. SLA must be labeled DEGRADED_SCHEDULED; failed/skipped Claude events need explicit pending/escalation, no false completion.
- New secrets (owner PAT), bot-actor trust bypass, new Cloud Run, provider API access and forced main merge have not been authorized and aren't required to retain this fallback.

## ROY questions for this PR
1. Did first-party Claude Routine actually trigger **this** PR? Provide exact event type, PR number, current head, session id if available. Do not equate this trigger to #449/#450 (different events). Is cross-session Routine history actually accessible? If not `UNKNOWN`.
2. Based on GitHub-verified evidence, can you substantively conclude that #449/#450 are provider ingress failures, concurrency/queue, filter or just unknown? What first-party telemetry is missing?
3. Confirm whether owner-issue scheduled fallback is simpler and less risky than the same-SHA alias for second/final review, including correct review budget and no duplicate merge.
4. Should temp R2 Work event worker be deactivated now if #449 remains missing first review, and should the intentionally RED test PR #449/#450 close unmerged to end repeated noise, rather than forcing another ROY session?
5. Provide `ROY_FINAL_RCA=AGREE|AGREE_WITH_CHANGES|DISAGREE` and minimum concrete operational solution, explicitly distinguishing engineering repair from external provider reliability. **One grounded comment only**.

## Invariants
Test-only document+task on branch. No commit to `main`, no production deploy, no new permissions/tokens, no automatic financial/account/trading operations. A Roy `PASS` for this RCA is not release authority.
