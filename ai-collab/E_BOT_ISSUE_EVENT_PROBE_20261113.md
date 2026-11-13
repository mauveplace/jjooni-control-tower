# E bot-Issue external event delivery probe (2026-11-13)

## Scope
User approved **test-only** E experiment. Do **not** merge this PR or deploy anything. Preserve current hourly owner Work issue-writing fallback and current owner-only Claude issue_dispatch. No new secret, personal token, new cloud or trading.

## Why test instead of changing production
PR #431 main already emits a deduplicated authenticated GitHub Actions bot PR comment after CI. PR #433 demonstrated code correction + green CI + a bot comment, but Work did not establish instant receipt. Owner scheduled recovery #436 obtained a final ROY PASS; that is **not** evidence of bot instant delivery.

ROY recommended E: trusted main Action could issue a bot Issue, then external Claude issues.opened would perform read-only verified review with a separate bot trust branch. Before any production change, **prove Claude actually receives bot-authored issues.opened**. Current production issue_dispatch deliberately accepts only owner-authored Issues.

## Live experiment (one issue only)
The new test-only workflow \`.github/workflows/ai-collab-e-bot-issue-probe.yml\` is triggered by this PR's genuine pull_request.opened event, **only** when all actor/repository/exact branch gates match. It requests the job-local GitHub Actions token with \`issues: write\` and \`contents: read\`, **does not check out PR code**, scans actual issues for duplicates, and creates at most one issue with first line:

\`<!-- JJOONI-COLLAB-CI-ISSUE-PROBE-V1 pr=N head=FULL_SHA -->\`

This is NOT \`JJOONI-COLLAB-CI-ISSUE-V1\` (future production candidate), and NOT \`JJOONI-COLLAB-ISSUE-V1\` (current trusted owner request). No production Issue/Claude dispatcher may treat the PROBE as a genuine review request.

## Safety/design gate
\`e_bot_issue_gate.py\` is pure standalone candidate logic, and is NOT imported by the deployed dispatcher. Tests cover bot identity and first-party app slug, original main-Action source comment marker+id, authoritative CI run path/event/success/repo/head, exact task opt-in, present PR SHA, idempotency and no merge/deploy. A candidate decision remains read-only and does NOT establish Claude execution.

## Evidence checklist — do not confuse the two source events
1. PR opened: the **separate** Claude PR.opened Routine may review this design and reply \`ROY_REVIEW=...\` on PR. That proves PR event routing ONLY.
2. GitHub Actions run: verify genuine workflow name, event=pull_request, conclusion=success and job log with \`E_PROBE_BOT_ISSUE_CREATED number=X url=...\`. If absent, record BLOCKED rather than pretending a bot issue exists.
3. Bot Issue: fetch exact Issue X; verify user.login \`github-actions[bot]\`, user.type \`Bot\`, first-line PROBE marker, PR and SHA.
4. External event: to call **E_EVENT_DELIVERY=PASS**, obtain a first-party Claude scheduled Routine run **whose trigger context explicitly says \`issues.opened\` + the same Issue X event ID**, and the actual ROY issue or linked PR response. A PR.opened session, GitHub Issue creation alone, a manual Work run, or hourly polling are NOT proof.
5. If Claude receives but rejects the bot under owner-only policy, classify **DELIVERED_BUT_FILTERED**. If no first-party Claude trigger evidence, classify **UNVERIFIED**, not categorical \"no webhook\".
6. Do not modify Claude Routine, owner-only dispatcher, main, existing webhooks or automations from this experiment. Future adoption requires a separately approved production design/review and practical webhook delivery success.

## ROY-specific request
Review exact diff, the unusually narrow workflow permission, trigger identity, dedup and the separation of experiment vs production. Report technical and security findings, actual CI and event provenance. Do not claim the bot Issue's external delivery without first-party issue-opened run evidence.


## Observed live outcome and ROY first independent review
- PR #437 head at original event: \`79878d3cb772921d0d2db3dd11e7be90c5cb43eb\`. Genuine PR-triggered GitHub Actions run \`43413925883\` succeeded and created bot Issue #438 (GitHub issue id \`6369916433\`) at 11:03:27Z; exact author \`github-actions[bot]\`. Probe Issue is intentionally not a CI-green E production request.
- First-party ROY PR.opened Routine posted exact-original-HEAD \`ROY_REVIEW=NEEDS_CHANGES\` (original PR comment \`6851018383\`). Its trigger was **pull_request.opened** not bot Issue **issues.opened**. Therefore E external delivery remains \`UNVERIFIED\`.
- ROY's real REST inspection showed bot Issue \`performed_via_github_app=null\`. Initial future-candidate gate mistakenly required \`slug=github-actions\`; that would reject a real bot Issue. Candidate gate was corrected to require the stable bot \`user.id=41898282\`, bot type and login, and allow missing app slug while rejecting an explicitly foreign slug. A source-comment null app field is also tolerated only with stable bot id + verified marker and exact CI. Additional tests reject wrong numeric id and bool Issue IDs.
- ROY also noted the need to authenticate the **issuer workflow/run** independently from merely matching bot login (multiple same-repo workflows share the bot). Accordingly the candidate result explicitly includes \`issuer_run_verified=False\`; it is never a production authorization and a future independently approved design must add issuer-run verification before any trusted E routing. No change to owner-only dispatcher or Claude Routine is part of this experiment.
- Elevated GitHub Script dependency was SHA-pinned to the precise commit observed in successful runner logs. The workflow still triggers only \`pull_request.opened\`, so branch corrections do **not** generate another bot Issue. Original Issue #438 remains historical proof for its original exact HEAD, not current-head execution proof.

**Acceptance:** This experiment may be marked \`BOT_ISSUE_CREATION=PASS\` while \`E_EXTERNAL_DELIVERY=UNVERIFIED\`. Never interpret a later owner-authored final-review Issue or a PR.opened ROY review as proof that bot Issue #438 was delivered to Claude via \`issues.opened\`.
