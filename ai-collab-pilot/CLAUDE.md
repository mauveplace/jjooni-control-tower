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
