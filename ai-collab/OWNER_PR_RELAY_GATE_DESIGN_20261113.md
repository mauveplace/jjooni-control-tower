# E2 owner PR-opened relay — candidate gate, TEST ONLY

## Observed signal
- Owner PR A [#444](https://github.com/mauveplace/jjooni-control-tower/pull/444) and owner alias PR B [#445](https://github.com/mauveplace/jjooni-control-tower/pull/445) had different branch refs but identical commit SHA `2471a7fd882ac0f1b523f275a46e8d2a0affe062`.
- ROY's own first-party PR.opened Routine reported `ROY_RELAY_EVENT=CONFIRMED` / `ROY_E2_FEASIBILITY=CONDITIONAL` on PR B, [comment 6851483984](https://github.com/mauveplace/jjooni-control-tower/pull/445#issuecomment-6851483984). It cited a distinct Claude trigger for PR #445 and exact SHA; this is not evidence for bot Issue delivery or automatically generated aliases.
- Both test PRs closed **UNMERGED**. Existing hourly owner-Issue fallback remains enabled; E bot delivery uncertain, tracked in [#443](https://github.com/mauveplace/jjooni-control-tower/issues/443).

## Proposed workflow (not installed)
A genuine authenticated ROY `NEEDS_CHANGES` webhook on original PR A wakes owner-connected Work. Work independently verifies role/event/session and explicitly authorized code-edit scope, corrects one existing source file, and waits for one exact-head `AI Collaboration Read-Only Contract` CI success. Only then may Work evaluate `candidate_relay` with original live PR, changed task file list, authenticated first review, parent correction commit, official CI run and all existing relay records.

A result `CANDIDATE_ONLY` is **not a GitHub write authorization**. The transaction also needs a separate authenticated user approval, an immediate re-fetch/re-check for staleness and duplicates, and a same-repo owner-created alias branch at the exact corrected commit SHA. Then an owner-created **new alias PR B** targets main and causes GitHub `pull_request.opened` (the event already tested). ROY rechecks source PR A, task, SHA, CI, review budget and validity; authentic ROY's second review binds to the original PR's task+corrected SHA. Alias is NEVER merged.

Because B could be double-merged accidentally, the alias should be treated as **review transport only**, closed after review, with both PRs never auto-merged. Draft alias PR trigger behavior has **NOT been tested**. Cost: one extra PR CI run and Claude session per real correction.

## New static guard code
- `ai-collab/owner_pr_relay_gate.py` has no network calls or state mutation, is **not imported by production** and cannot open a PR.
- `candidate_relay()` confirms original PR, task E2 opt-in, authenticated prior ROY NEEDS_CHANGES, exactly one source correction commit, exact current-head green CI, and durable duplicate/review-budget evidence. It returns `CANDIDATE_ONLY` with **write_authorized=false, merge_allowed=false, deploy_allowed=false** even if every gate passes.
- `verify_opened_alias()` checks distinct branch and PR number, exact SHA, base main, same-repo source. It does not authenticate an actual Claude event.
- All samples in `test_owner_pr_relay_gate.py` are synthetic. They validate the gate, not external event reception, and the code cannot obtain an external owner signature or Claude first-party session proof itself.

## Release constraints
This PR intentionally contains only a single added active task JSON, this document, static Python gate and regression tests. No changes to main workflows, Work scheduled prompts or immediate webhook, Claude Routines, secrets, GitHub permissions, Cloud Run, finance systems or production dispatcher. **NO MAIN MERGE/DEPLOY** unless explicitly newly approved by the user. Current E2 rollout status remains CONDITIONAL until a real ROY feedback → Work correction → CI success → owner-alias PR → ROY second-review test is independently proven end-to-end.


## ROY first review NEEDS_CHANGES — corrections
Original ROY code review [comment 6851618534](https://github.com/mauveplace/jjooni-control-tower/pull/446#issuecomment-6851618534) disclosed actual fail-open and malformed-input crashes. The isolated code and regression tests have been corrected without changing any production file:

- Accept **only exact boolean** independently authenticated owner approval; reject truthy strings and missing booleans.
- Strict PR number/author/state, same-repo original source and alias identity; reject malformed nested REST objects rather than throwing exceptions. Draft alias is blocked because draft-trigger delivery has not been proven.
- Task reviewers MUST be a list with exactly one ROY member. Any second active task JSON in the PR diff, even removed/renamed, fails.
- Reject unsafe paths (dot segments, backslashes and self-modifying guard), require the corrected source file is actually in the same PR changed-file list.
- CI must match the original SHA, workflow name/path, verified **workflow ID 411466939** from genuine GitHub run 43417762051, positive run ID and attempt, status and source repository. **Real GitHub workflow-run REST omitted `app`; a missing app slug cannot be used as proof of a foreign origin.** If present a foreign slug is rejected; caller must independently fetch the run from GitHub and authenticate its source.
- Any prior alias relay for the same **original PR+task** blocks another one, regardless of whether its HEAD was older or its PR is closed; ledger type validation and cross-original+alias review count = exactly 1 before B request. This is more conservative than per-SHA dedup.
- These functions do NOT authenticate a first-party Claude session, Work actor, GitHub event delivery, or external owner approval themselves. The `external_owner_approval` and `verified_first_party` values are trusted caller assertions requiring separate real-source proof. Therefore they never become sufficient authorization for a write, trade or deployment.
- New negative tests exercise malformed GitHub nested objects, mismatched author, truthy strings, bool/int confusion, wrong task shapes, extra task deletions, source/PR changed file mismatch, path traversal, future/old relays and alias policy.
- This PR will receive at most **one second/final ROY review** on the new exact HEAD. A PASS may confirm code-review quality but not unattended E2 workflow completion.


## ROY FINAL 2/2 — NEEDS_CHANGES, no third review
- Actual ROY final [PR comment 6851720877](https://github.com/mauveplace/jjooni-control-tower/pull/446#issuecomment-6851720877), triggered by first-party Claude `issues.opened` for owner-authored Issue #447, verdict **NEEDS_CHANGES**. ROY verified that all **initial** critical fail-open and malformed-metadata flaws had been corrected, with 29 targeted tests and 188 total tests PASS at prior HEAD `54747f9952cd66274af3b4db5a7ff3754994f05d`.
- The remaining medium defect **F1**: a renamed file with `previous_filename` outside allowed `ai-collab/` paths or from another task JSON could still pass because the gate examined only `filename`.
- JJOONI has now **blocked every renamed PR file and any `previous_filename` evidence** (stricter than validating old paths), and added two direct F1 regressions plus extra malformed CI app, float workflow ID, control-character path and nested task tests. All are pure test-code changes.
- **No third ROY review requested**, honoring the exact 2-review budget. The code may pass GitHub CI independently, but no ROY PASS exists on the post-F1 HEAD. It remains a test-only unmerged candidate, NOT a production-certified or unattended relay.
- The same task on a *different original PR* is a distinct scope in the dedupe key; first-party verification, durable ledger completeness and Work owner authorization are still mandatory at real runtime.
