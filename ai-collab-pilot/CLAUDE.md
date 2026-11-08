# Current task (v0.2): ROY independent review of TRI-POD data repair

**The initial read-only connection test is complete.** For this new collaboration task, follow the bounded procedure below and do not repeat the initial test comment:
- Read `COLLABORATION.md`, `tasks/D-261108-TRIPOD-DQ-002.json` and PR #302's `JJOONI / COLLAB TASK` dispatch comment.
- Review the **immutable historical source commit** `8836f699b1676bc015fe13032ee3e98198a57976` independently. This snapshot field is intentionally not the branch's moving HEAD.
- Challenge data corruption claims, calendar/VIX alignment, historical NAV, benchmark apples-to-apples, exact repair acceptance criteria and test design. Do not write code.
- Use `python3 ai-collab-pilot/coordinator.py template --task ai-collab-pilot/tasks/D-261108-TRIPOD-DQ-002.json --actor ROY` to generate a **short structured comment**. It must begin with the exact marker on the first line. Replace placeholders with actual findings and session link/UNKNOWN.
- Check existing PR comments for this task+ROY+source SHA marker; if present, do not post a duplicate. If absent, post **one** PR Conversation comment only.
- No `relay.py add`, Git commits, pushes, merges, deploy, paid APIs, sensitive data or brokerage orders. A comment is not an approval for source changes.

## Historical read-only connection-test instructions (archived)
# ROY (Claude Code) — pilot PR #302 only

## First connection test: READ-ONLY
- Work only against GitHub PR #302 (title must contain `[AI-COLLAB]`) for repository `mauveplace/jjooni-control-tower`.
- Routine clones default branch `main` initially. Fetch PR head explicitly: `git fetch origin refs/pull/302/head`, then check out the fetched commit in the disposable cloud workspace. This does **not** change GitHub branches.
- Review `ai-collab-pilot/README.md`, `relay.py`, `test_relay.py`, `task.json`, and the agent role files. Run `python -m unittest discover -s ai-collab-pilot -p 'test_*.py' -v` against PR-head files; report actual pass/fail/error counts.
- Independently review the candidate strategy methodology for look-ahead, stale data, trade timing, transaction costs and overfitting. No invented results.
- Output ONE concise PR review comment (or session report if comments are unavailable). Label it `ROY / READ-ONLY CONNECTION TEST`; include execution time, verified PR head SHA, test output summary, issues, and whether actual write-to-PR-comment succeeded.
- **Do not** call `relay.py add` or edit `task.json` in the first connection test. Do not commit, push, merge, deploy, change workflows, create PRs, change settings, read private MAIOS/account data, use any trading APIs, or expose credentials.
- A successful cloud session only proves the routine ran; only a visible authored comment proves the comment link worked.

## Later handoffs
Only after CIO separately authorizes changing this procedure may ROY write the `risk_review` message. That requires a revised scoped routine and verified author provenance. Never use the current read-only routine for automatic repository writes.
