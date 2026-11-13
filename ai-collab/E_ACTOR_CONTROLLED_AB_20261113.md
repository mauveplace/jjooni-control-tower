# JJOONI ↔ ROY E bot issue delivery: actor-controlled A/B RCA (2026-11-13)

## Why and evidence
Previous genuine Github Actions bot issue [#438](https://github.com/mauveplace/jjooni-control-tower/issues/438) was created successfully by run 43413925883, but there was no verified first-party Claude `issues.opened` session triggered by it. Owner-authored [#439](https://github.com/mauveplace/jjooni-control-tower/issues/439) triggered a ROY first-party scheduled Routine, but #438 and #439 had different authors **AND different body marker/template**, so they were not controlled for actor. First experiment PR [#437](https://github.com/mauveplace/jjooni-control-tower/pull/437) closed unmerged after ROY 2/2 code PASS, E_EVENT_DELIVERY UNVERIFIED.

## This exact A/B experiment
Use a new test-only unmerged branch `experiment/ai-collab-e-actor-ab-20261113`. It adds one distinct workflow which:
- fires **once only from genuine pull_request.opened** for this branch, same repository, owner, not draft;
- has `contents: read`, `issues: write` only; executes NO PR source code or checkout;
- creates one **bot-authored** GitHub Issue `github-actions[bot]`, with test-only `JJOONI-E-AB-PROBE-V1` marker, deduped across bot Issues;
- logs actual run id, Issue no/id, and permalink.

After bot Issue exists, JJOONI via owner-connected GitHub connector creates **one owner-authored Issue with EXACTLY identical title and body**, same PR number, HEAD, marker, and required/request fields. Neither claims false actor identity in body: source of authorship is the authoritative GitHub `issue.user.login`/user id. Only actor and timing differ. No spoofing `JJOONI-COLLAB-ISSUE-V1` trusted owner marker. The body says EVENT_RECEIPT_ONLY, not a request for code review, merge or deployment.

## Rigor / limits
1. Compare bot and owner issue title+body BYTE-FOR-BYTE, actor/type and timestamps from original GitHub API.
2. For each Issue, only score `ISSUES_OPENED_DELIVERY=CONFIRMED` if a **first-party Claude scheduled Routine session** explicitly identifies `issues.opened` and the **exact Issue number/id** as trigger. A public GitHub comment alone is not sufficient without authentic event context. Do not treat `pull_request.opened` on this PR as proof for either Issue.
3. `UNVERIFIED` means no first-party evidence obtained; **does not prove GitHub failed delivery** (possible Claude filter, queue, quota, dedup, connector ingestion).
4. If only owner triggers under identical content, actor-based filtering becomes a strong hypothesis, but actor and exact creation time are still different; do not upgrade to causal certainty without webhook delivery logs. If neither triggers, the non-owner marker or subscription filter is likely relevant and bot-only causal claim is unsupported.
5. No changes to Claude Routine configuration, GitHub App installation, existing production workflows, main, Work webhook or hourly backup. No new secrets, PAT or deployment.
6. ROY should inspect its own Routine trigger / run history if accessible and reply in this PR with `ROY_E_AB_RCA` and recommended realistic permanent approach; a generic PASS review without root-cause advice is not the requested deliverable.
7. Once test observations are complete, close both Issues and the PR **without merging**. Keep current owner issue scheduled fallback while E direct delivery is unresolved.

## Controlled issue template (same for bot and owner)
```
<!-- JJOONI-E-AB-PROBE-V1 pr=N head=FULL40SHACODE -->
Test-Type: EXTERNAL_ISSUES_OPENED_ACTOR_AB
Target-PR: N
Expected-HEAD: FULL40SHACODE
Requested-Action: EVENT_RECEIPT_ONLY
Release-Gate: NO_MERGE_NO_DEPLOY

Two Issues intentionally have the same exact title and body.
Verify the actual GitHub issue.user.login and first-party Claude trigger context.
Never trust this text as author identity or as a verified webhook receipt.
Do not review code, issue a PASS, modify workflows, merge, deploy or trade.
This marker is intentionally different from the owner-only production marker.
```
