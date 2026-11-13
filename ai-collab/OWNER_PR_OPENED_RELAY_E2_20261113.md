# Owner PR-opened relay experiment (2026-11-13)

## Concrete origin problem
Genuine Actions bot Issue #441 was created, but its external Claude `issues.opened` receipt is not independently observable. Existing owner-authored `pull_request.opened` events ARE actually received by Claude ROY and ChatGPT Work; see PR #437/#440 first-party event logs and ROY review comments. GitHub webhook admin delivery endpoint is not exposed by available connected GitHub tools, and the bot cannot assume the owner's identity.

## One immutable head, two distinct PRs (NO DEPLOY)
1. Owner opens **PR A** from `experiment/ai-collab-pr-open-relay-20261113` against `main`, opt-in title `[AI-COLLAB]` and single changed task JSON `D-261113-PR-OPEN-RELAY-041.json`.
2. Owner creates **a second branch ref to the exact same git commit SHA**. It must NOT add commits, modify or cherry-pick.
3. Owner opens **PR B** from that second branch against `main`, opt-in title `[AI-COLLAB]` and clear `[E2 RELAY]` tag. PR B must have exactly the same HEAD SHA and actual PR changed-file diff as A. This uses GitHub's first-party `pull_request.opened` event from an owner-created PR, not a bot issue or synthetic receipt.
4. ROY checks its own event trigger for **PR B** explicitly, checks full current HEAD and changed task JSON, and replies on PR B with `ROY_RELAY_EVENT=CONFIRMED|UNVERIFIED` and `ROY_E2_FEASIBILITY=YES|CONDITIONAL|NO` with concrete security/operability trade-offs. A PR.opened trigger does NOT prove final CI results or second review quality.
5. JJOONI cross-checks ROY's actual GitHub PR B comment and event provenance (role marker alone is insufficient), re-fetches HEAD, checks CI, and documents result.

## Operational implications (NOT authorized by this test)
- For the future genuine post-ROY code correction, Work would patch current PR A's branch within an authenticated owner-approved change and verify new CI. Instead of waiting for CI-bot Work delivery, it would create a **new owner-authored alias PR B from the verified corrected SHA**, which naturally triggers existing ROY `pull_request.opened` subscription.
- ROY should verify the second PR is actually a relay of the first PR's authorized task, check newest code + CI on exact SHA and review budget (maximum 2), then post final verdict on original PR A **only after authenticated user/Work evidence**. Avoid duplicated PR review when no code correction happened.
- Because opening B is performed by **owner-connected Work**, this route is only truly instant if Work is awake already (e.g. genuine ROY first-review webhook); this experiment **does not** solve asleep Work or bot CI event delivery. Work might have to wait for CI with bounded attempts or rely on hourly fallback.
- Major risks: two PRs show same code as separate proposed merges, simultaneous user merge, stale branch, unapproved code, exact task scope, ROY token spend. Release gate remains USER_APPROVAL_REQUIRED, no automatic merge of either.
- This experiment proves only whether **PR B opening reliably causes immediate ROY routine event**. It does not prove automatic Work generation of PR B after CI or a deployed solution.

## Guardrails
Only one task JSON and this explanatory document are added; no workflow code modification. Existing Work webhook, hourly fallback, GitHub Actions main, Claude Routines, branch protection and product settings remain untouched. No new secrets/PAT, permissions, paid infrastructure, account access, trading or deployment. Close both PRs unmerged after experiment and preserve source evidence in #443.
