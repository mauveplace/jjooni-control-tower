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
