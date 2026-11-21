# ROY private business review — GitHub ticket / private Drive handoff

**Scope:** non-code independent review involving authorized private connected files, audio, meeting notes, or policy documents. Does not apply to GitHub source-code reviews, which retain existing [AI-COLLAB][ROY-REQUEST] rules.

## Ticket creation

Only the authenticated GitHub repository owner may issue a private review ticket. Create ONE new GitHub Issue with an opaque unique Task-ID; do not revive/duplicate an existing ticket. Use this exact title prefix:
`[AI-COLLAB][ROY-PRIVATE]`

Issue body (the HTML marker must be the first line):
```text
<!-- JJOONI-ROY-PRIVATE-TICKET-V1 -->
Task-ID: <GENERIC-TASK>-<YYYYMMDD>-<NN>
Date-Range: YYYY-MM-DD~YYYY-MM-DD
Request: <one generic sentence; no sensitive nouns, rates, names or evidence>
Private-Request-Doc: <generic private Google Drive document title>
```

**Public GitHub confidentiality boundary:** do NOT put confidential meeting names, organizations/partners, participants, amounts, fees, document filenames, private Google Drive/Plaud IDs or URLs, internal quotations or audio/transcript contents into the issue title/body, comments, task metadata, PR or CI logs. Keep detailed scope and source locations in a PRIVATE document in an authorized Drive folder, with unchanged sharing permissions.

## ROY execution (external Claude routine, not installed by this file)

The owner has reported an existing hourly ROY review routine at minute :25 that supports authorized private apps. This is **configuration reported by the user**, not a repo-enforced schedule or a verified subscription. JJOONI can emit the ticket; only a genuine ROY execution may post review status. The routine must:
1. Verify actual GitHub event / owner identity, ticket syntax and dedupe Task-ID; resolve the approved private request document by generic title through its own connected Drive access.
2. Post its own separate GitHub comment with exact first-line `검토시작` and `stage=PRIVATE_START` only when a real review begins. Never have JJOONI impersonate ROY.
3. Read authorized private sources. For audio, distinguish original audio independently replayed or verified from transcript-only materials. Mark `DONE`, `PARTIAL`, `NOT_REVIEWED` accurately.
4. Save detailed findings privately as `ROY검토_<Task-ID>_<YYYYMMDD>` in an authorized Drive folder, preserving original permissions. DO NOT publish findings to GitHub.
5. Post a distinct terminal GitHub status comment: `검토완료` with `stage=PRIVATE_DONE` and `ROY_AUDIO_REVIEW=DONE|PARTIAL`, or `검토차단` with `stage=PRIVATE_BLOCKED` and a nonsensitive reason. No code or source mutations, approvals, deployment or external disclosures.

## JJOONI tracking and follow-up

- Ticket issued ≠ ROY triggered ≠ ROY started ≠ review complete. Verify original comments and genuine Claude execution provenance where possible; GitHub user identity alone cannot prove authorship.
- After start, if no terminal status within 3 hours, report delayed status to user at the next authorized check. This document alone does not schedule that check; use an already authorized automation or explicitly set one up rather than claiming background monitoring.
- Do not create duplicate tickets or repeated wake-up comments for the same task.
- On `PRIVATE_DONE`, retrieve the actual private Drive findings and compare with JJOONI's independent interpretation before reporting any business conclusions. If the Drive document is inaccessible, say so; `PARTIAL` never means full audio review.
- Keep source-code reviews on the separate public PR/Issue workflow. Do not add private connectors to broadly triggered public GitHub event routines merely to bypass this handoff.

## Limitations

A GitHub Markdown edit cannot modify Claude Code Routines / ChatGPT Work subscriptions, connector availability, schedules, or effective user-approved sharing. Test with a real ticket, a ROY-authored start comment, a ROY terminal comment, and private Drive result readback. Do not claim success before these events.
