# JJOONI AI Collaboration — 3-AI pilot (2026-11-07)

**Status: message relay prototype; no autonomous cross-provider agent calls. Not deployed.**

## Purpose

Allow GPT/Codex (JJOONI), Claude Code (ROY) and Gemini/Antigravity (JJANGGU) to hand off *short task messages* without repeatedly reading the MAIOS Google Sheet. Use existing subscription tools where officially supported; never treat subscription login as a general purpose API token.

## Handoff contract

- GitHub draft PR is the lightweight discussion/notification surface. `task.json` is the task-specific state. **No spreadsheet reads in normal handoffs.**
- `relay.py` performs only local/offline validation and state updates; no LLM network calls, broker calls, cloud services, or credentials.
- JJOONI writes `proposal`; ROY writes `risk_review`; JJANGGU writes `data_review`; after both independent reviews, JJOONI writes `synthesis`.
- Each message is one short result plus `ref` for the actual evidence. Limit 1,200 characters/message, exactly four messages/cycle, no retry loops.
- True author/source must be verified against the authenticated service's execution log, not inferred from the `role` string in JSON.

## Mobile-only bootstrap (account owner actions required)

1. Open this experiment as a **draft PR** in GitHub. The PR becomes the shared discussion thread; do not merge into production.
2. In [Codex Cloud](https://chatgpt.com/codex), connect this GitHub repository. Ask it to read `ai-collab-pilot/task.json`, propose a verification methodology without inventing returns, and add the `JJOONI/proposal` message via `relay.py add` on the experiment branch.
3. In [Claude Code Routines](https://claude.ai/code/routines), sign in with the subscription, grant the Claude GitHub App access to this repository only, and create a **read-only connection-test** routine for PR #302. **First run via Run now**, not an event: PR #302 was already opened. Fetch `refs/pull/302/head` explicitly because web routines clone the default branch. The first review must produce only a PR comment or a session report; **no task.json update, commits, pushes or deployments**. Read `CLAUDE.md` for the exact test steps. Only after this is verified should the account owner configure the PR event with filters: title contains `[AI-COLLAB]`, head branch starts with `experiment/ai-collab-`, base branch equals `main`, and draft=true. Do not subscribe to all PR actions. Exclude unnecessary connectors. Confirm extra usage billing is disabled.
4. Open [Antigravity Remote Agents](https://antigravity.google.com) from the mobile browser with the Google AI Pro/Ultra personal account, create a remote project, attach **only** this GitHub repository, and use the `ai-collab-pilot/GEMINI.md` **read-only test** prompt. No Gemini API keys or Cloud billing. The initial run should produce a single PR comment (or report a permission failure), **not** write `data_review` to `task.json`. Consumer Gemini Code Assist GitHub app was discontinued in July 2026; do not try to install that retired service. Automatic GitHub event-triggered Gemini runs are **not yet implemented**.
5. After a real JJANGGU comment appears, compare ROY and JJANGGU's independently authored PR comments with JJOONI's proposal. Moving them into `task.json` or invoking JJOONI synthesis automatically requires a **separately approved** write-authorized follow-up phase. Publish only verified outcomes to Control Tower/MAIOS after CIO review.

## Commands

```bash
python ai-collab-pilot/relay.py status ai-collab-pilot/task.json
python ai-collab-pilot/relay.py handoff ai-collab-pilot/task.json
python ai-collab-pilot/relay.py add ai-collab-pilot/task.json --role JJOONI --phase proposal --body 'Methodology only; performance not verified.' --ref 'methodology-v1'
python -m unittest discover -s ai-collab-pilot -p 'test_*.py'
```

## Non-negotiable safety

- This Control Tower GitHub repo is **public**. Do not put real accounts, holdings, private MAIOS cells, PB snapshots, credentials, personal facts, bank/customer info or private documents here. Use a separately created **private** repository before a private-data experiment.
- No orders, no broker access, no deployment, no scheduler, no production policy or ACTIVE rule updates. `SYSTEM_REVIEW_ONLY`.
- Do not start pay-as-you-go, extra usage, billed Google Cloud project, or a paid GitHub runner. Subscription quotas may still be consumed.
- No AI is considered CONNECTED just because task text exists. Claude and Gemini must authenticate and show actual independent responses.
- GitHub is a lightweight relay, not *native direct* cross-model chat. Fully unattended multi-agent interaction may require extra orchestration and/or API billing.

## Verification gates

1. The offline unit tests pass.
2. JJOONI proposal has a real execution record and an explicit source.
3. ROY's first verified PR comment succeeded (2026-11-08). JJANGGU's first independently authored test comment or session report still requires Google account authorization and execution. Neither pilot is currently authorized to write relay `risk_review` or `data_review` automatically.
4. JJOONI synthesis includes unresolved disagreements and does not claim any unverified trading returns.
5. Only the final verified summary is copied into any durable investment record after CIO review.
