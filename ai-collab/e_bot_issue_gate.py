"""Isolated E-architecture candidate validator. NOT wired into issue_dispatch or a Routine.

No GitHub writes, review submission, PR merge or deploy are authorized by the result.
The live probe uses a DIFFERENT marker that this validator must reject.
"""
import re

REPO = "mauveplace/jjooni-control-tower"
MARKER = "<!-- JJOONI-COLLAB-CI-ISSUE-V1 -->"
COMMENT = "JJOONI-CI-GREEN-ROY-HANDOFF-V1"
WORKFLOW = "AI Collaboration Read-Only Contract"
PATH = ".github/workflows/ai-collab-contract.yml"
SHA = re.compile(r"[a-f0-9]{40}\Z")
TASK = re.compile(r"D-[0-9]{6}-[A-Z0-9-]+\Z")
FIELD = re.compile(r"(Target-PR|Task-ID|Expected-HEAD|CI-Run|Source-Comment|Mode|Requested-By):[ \t]*(.*)\Z")


def _fields(body):
    if not isinstance(body, str) or not body.replace("\r\n", "\n").startswith(MARKER + "\n"):
        return None
    fields = {}
    for line in body.replace("\r\n", "\n").splitlines()[1:]:
        m = FIELD.fullmatch(line)
        if m:
            if m.group(1) in fields:
                return None
            fields[m.group(1)] = m.group(2).strip()
    required = ("Target-PR", "Task-ID", "Expected-HEAD", "CI-Run",
                "Source-Comment", "Mode", "Requested-By")
    if any(not fields.get(k) for k in required):
        return None
    return fields


def decide_ci_bot_candidate(event, pr, source_comment, ci_run, task,
                            known_issue_ids=()):
    """All five original objects must be independently fetched by the caller."""
    blocked = {"decision": "BLOCKED", "execution_confirmed": False,
               "merge_allowed": False, "deploy_allowed": False}
    if any(not isinstance(x, dict) for x in (event, pr, source_comment, ci_run, task)):
        return blocked
    if event.get("action") != "opened" or (event.get("repository") or {}).get("full_name") != REPO:
        return blocked
    issue = event.get("issue") or {}
    author = issue.get("user") or {}
    sender = event.get("sender") or {}
    if issue.get("pull_request") or not isinstance(issue.get("id"), int):
        return blocked
    if issue["id"] in known_issue_ids:
        return {**blocked, "decision": "DUPLICATE"}
    if not (author.get("login") == sender.get("login") == "github-actions[bot]"
            and author.get("type") == "Bot"
            and (issue.get("performed_via_github_app") or {}).get("slug") == "github-actions"):
        return blocked
    f = _fields(issue.get("body"))
    if f is None or not str(issue.get("title", "")).startswith("[AI-COLLAB][ROY-REQUEST] "):
        return blocked
    if (not f["Target-PR"].isdigit() or f["Target-PR"].startswith("0")
            or not TASK.fullmatch(f["Task-ID"])
            or not SHA.fullmatch(f["Expected-HEAD"])
            or not f["CI-Run"].isdigit() or f["CI-Run"].startswith("0")
            or not f["Source-Comment"].isdigit() or f["Source-Comment"].startswith("0")
            or f["Mode"] != "SYSTEM_REVIEW_ONLY" or f["Requested-By"] != "CI"):
        return blocked
    head = pr.get("head") or {}
    if (pr.get("number") != int(f["Target-PR"]) or pr.get("state") != "open"
            or pr.get("merged") or pr.get("draft")
            or (pr.get("base") or {}).get("ref") != "main"
            or head.get("sha") != f["Expected-HEAD"]
            or (head.get("repo") or {}).get("full_name") != REPO
            or not str(head.get("ref", "")).startswith("experiment/ai-collab-")):
        return blocked
    if (task.get("task_id") != f["Task-ID"] or task.get("repository") != REPO
            or task.get("base_branch") != "main"
            or task.get("mode") != "SYSTEM_REVIEW_ONLY"
            or task.get("release_gate") != "USER_APPROVAL_REQUIRED"
            or "ROY" not in (task.get("required_reviewers") or [])
            or task.get("auto_roy_review_after_ci") is not True):
        return blocked
    if (str(source_comment.get("id")) != f["Source-Comment"]
            or (source_comment.get("user") or {}).get("login") != "github-actions[bot]"
            or (source_comment.get("performed_via_github_app") or {}).get("slug") != "github-actions"):
        return blocked
    marker = (r"<!-- " + COMMENT + r" task=" + re.escape(f["Task-ID"])
              + r" pr=" + re.escape(f["Target-PR"])
              + r" head=" + f["Expected-HEAD"] + r" run=" + f["CI-Run"] + r" -->")
    body = source_comment.get("body") or ""
    if not body.splitlines() or not re.fullmatch(marker, body.splitlines()[0]):
        return blocked
    if len(body.splitlines()) < 2 or body.splitlines()[1] != "SOURCE=GITHUB_ACTIONS_CI_COMPLETED":
        return blocked
    if (str(ci_run.get("id")) != f["CI-Run"]
            or ci_run.get("name") != WORKFLOW or ci_run.get("path") != PATH
            or ci_run.get("event") != "pull_request"
            or ci_run.get("status") != "completed" or ci_run.get("conclusion") != "success"
            or ci_run.get("head_sha") != f["Expected-HEAD"]
            or (ci_run.get("repository") or {}).get("full_name") != REPO
            or (ci_run.get("head_repository") or {}).get("full_name") != REPO):
        return blocked
    return {**blocked, "decision": "CANDIDATE_READ_ONLY",
            "issue_id": issue["id"], "target_pr": pr["number"],
            "head_sha": f["Expected-HEAD"], "source_comment_id": int(f["Source-Comment"]),
            "reason": "Candidate only; independent Claude run, tests and dedup must still be verified"}
