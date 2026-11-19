# JJOONI Windows PC relay v1 — PC-hosted Codex + Claude + GitHub

## Objective

Use the user's Windows PC as an always-available **while powered on and signed in** local AI collaboration engine, not just a GitHub PR/Issue waiting room. The two local executable agents are Codex CLI (JJOONI-local) and Claude Code CLI (ROY-local). They use existing CLI subscription logins, read public repo data through GitHub CLI and post structured GitHub handoffs. This **does not** remotely wake the hosted ChatGPT Work chat directly, and Claude CLI is not the same identity as a cloud Claude Routine.

This PR is read-only for models, with public GitHub comments only; it never edits source, merges, deploys, or trades.

### Real functions

1. **Owner-authored public Issues:** title starts with [PC-COLLAB], first body line exactly <!-- JJOONI-PC-TASK-V1 -->. Local agent conducts Codex first-pass → Claude challenge → Codex synthesis, posts one deduplicated comment automatically. This is **direct local multi-agent work without a human relaying between their websites**.
2. **Open opted-in [AI-COLLAB] PRs:** if Claude Cloud ROY leaves a first-line V4 review on current PR HEAD, the local PC invokes Codex with the actual PR diff, independently analyzes it and posts one JJOONI-PC-HANDOFF-V1 comment with source comment ID and HEAD. This does not claim a Work webhook was received.
3. **Optional local Claude fallback:** after 10 minutes with no current-HEAD Cloud ROY review, PC invokes local Claude in plan mode and posts a visibly tagged LOCAL_CLAUDE_CLI comment. Not official ROY Cloud review or release approval.
4. Durable deduped JSON event ledger, once-only comment check, one running process file lock, bounded agent calls (12 per model per UTC day), 90-second polling, no repeated task PR generation.

### Install on Windows once

Requires Windows Terminal/PowerShell, Git, Python 3.12, GitHub CLI, Node.js LTS, Codex CLI and Claude Code CLI. The installer diagnoses missing commands and prints installation commands; it does not silently install paid dependencies.

1. Sign in once interactively: gh auth login; codex login; claude (login). Use existing appropriate user subscriptions, not metered API credentials.
2. Clone: gh repo clone mauveplace/jjooni-control-tower (or pull latest main after this PR merges).
3. From repo root run in PowerShell:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-collab\pc-relay\setup.ps1
4. Confirm Y. It installs **only** a Startup shortcut for the current Windows user (not a Windows service requiring admin rights).
5. Dry run first:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-collab\pc-relay\run.ps1 -Once -DryRun
6. Start:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-collab\pc-relay\run.ps1

Logs: USERPROFILE\\.jjooni-pc-relay\\relay.log. Ledger: same folder ledger.json. Startup runs after each user logon. A powered-off, asleep or signed-out PC cannot execute this relay, so the existing cloud GitHub/Claude Routines remain the fallback.

**For the owner:** Submit a public task by asking JJOONI to create an owner-authored GitHub Issue with title [PC-COLLAB] ... and body beginning with the exact marker specified above. The PC will take it from there. NEVER include bank/private account data, keys, customer records or non-public material.

### Safety/acceptance

- Claude and Codex use no locally stored API key in this app. If ANTHROPIC_API_KEY, OPENAI_API_KEY or CODEX_API_KEY is in environment, the runner refuses to start because it could generate unauthorized metered charges.
- GitHub comments are sent under the locally authenticated GitHub CLI identity; a github mauveplace comment alone is not proof of external ROY Cloud session identity.
- PRs must match main, one active changed task JSON, ROY required and SYSTEM_REVIEW_ONLY. Local read-only run cannot override that mode.
- Codex runs with --sandbox read-only and Claude with --permission-mode plan. This helps limit the agents, but sandboxing is not a substitute for Windows OS account separation.
- No port exposure, persistent webhook tunnel, broker/account access, main merge, deployment, or external API subscription change.
- Completion checks: issue → three local agent invocations → exactly one GitHub comment; verified ROY original ID → exactly one Codex handoff; restart PC → ledger resumes without duplicates. Hosted Work webhook E2E must be proven separately.
- To uninstall, remove Startup shortcut named JJOONI PC Relay.lnk and stop running process. No new paid infrastructure needs deletion.

### Future gate

Local code modification and branch push will require a separately reviewed writer policy, isolated worktree, verified least-privilege identity and a real end-to-end permission test. **Do not merge the unresolved #333 V1 writer design as a shortcut.**
