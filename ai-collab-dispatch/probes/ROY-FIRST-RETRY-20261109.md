# ROY-first PR event probe — retry (2026-11-09)

Retry of PR #319 after the user reported widening the ChatGPT Work GitHub event subscription (~08:37 KST).

**Only question this probe answers:** does ChatGPT Work (JJOONI) start **automatically** from this PR's `pull_request.opened` event, without a manual user prompt?

Evidence required from JJOONI: the Work run start time and that it was event-triggered. A comment written because the user asked in chat does not count.

**Known, out of scope here:** `main` still contains the completed `D-261108-EVERGREEN-COLLAB-006.json`, so this HEAD has two active task files (JJOONI finding on #319; fix pending in #320/#321). A dispatcher may therefore reject the task as ambiguous — that is expected and is not a failure of the wake-up test. `JJANGGU` in `required_reviewers` remains a placeholder because V4 does not yet allow JJOONI there.

No production code, data, workflow, strategy or deployment change. Do not merge; close after recording the result.
