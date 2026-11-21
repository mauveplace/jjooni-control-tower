#!/usr/bin/env python3
"""Read-only GitHub PR comment router for JJOONI / ROY / JJANGGU.

No model calls, API credentials, brokerage access, writes, deployment or scheduling.
Comment role is self-asserted; never treat parsed authorship as authenticated.
"""
import argparse
import json
import re
from pathlib import Path

TAG = re.compile(
    r"\A<!-- JJOONI-COLLAB-V2 task=([A-Za-z0-9._-]{1,128}) "
    r"actor=(ROY|JJANGGU) kind=review head=([a-f0-9]{40}) -->\s*\n"
)
ACTORS = ("ROY", "JJANGGU")
MAX_COMMENT = 12000

def validate_task(task):
    if not isinstance(task, dict) or not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", str(task.get("task_id", ""))):
        raise ValueError("Invalid task identifier")
    if not isinstance(task.get("head_sha"), str) or not re.fullmatch(r"[a-f0-9]{40}", task["head_sha"]):
        raise ValueError("Invalid pinned HEAD SHA")
    if task.get("mode") != "SYSTEM_REVIEW_ONLY" or task.get("privacy") != "PUBLIC_DATA_ONLY":
        raise ValueError("Unsafe task mode/privacy")
    if not isinstance(task.get("objective"), str) or not task["objective"].strip():
        raise ValueError("Missing objective")
    return task

def parse_comment(comment):
    if not isinstance(comment, dict):
        return None
    body = comment.get("body")
    if not isinstance(body, str) or len(body) > MAX_COMMENT:
        return None
    m = TAG.match(body)
    if not m or not body[m.end():].strip():
        return None
    return {"task_id": m.group(1), "actor_claim": m.group(2), "head_sha": m.group(3),
            "id": str(comment.get("id", "")), "url": str(comment.get("html_url") or comment.get("url") or ""),
            "github_user": (comment.get("user") or {}).get("login") if isinstance(comment.get("user"), dict) else None,
            "provenance": "UNVERIFIED_ROLE_CLAIM"}

def summarize(task, comments):
    validate_task(task)
    if not isinstance(comments, list):
        raise ValueError("Comments must be a JSON array")
    relevant = [m for c in comments if (m := parse_comment(c)) is not None
                and m["task_id"] == task["task_id"] and m["head_sha"] == task["head_sha"]]
    grouped = {actor: [m for m in relevant if m["actor_claim"] == actor] for actor in ACTORS}
    missing = [actor for actor in ACTORS if not grouped[actor]]
    duplicates = {actor: len(grouped[actor]) for actor in ACTORS if len(grouped[actor]) > 1}
    state = ("WAITING_FOR_" + "_AND_".join(missing)) if missing else "AWAITING_HUMAN_SOURCE_VERIFICATION"
    if duplicates:
        state = "DUPLICATE_CLAIMS_REVIEW_REQUIRED"
    return {"task_id": task["task_id"], "pinned_head_sha": task["head_sha"],
            "state": state, "missing_reviews": missing, "duplicate_claims": duplicates,
            "reviews": {role: entries[:1] for role, entries in grouped.items()},
            "next_action": ("Request missing actor's one review comment" if missing else
                            "Verify each review's actual agent session, then ask JJOONI for synthesis"),
            "safe_to_trade": False, "safe_to_deploy": False,
            "agent_authentication": "NOT_ESTABLISHED_BY_GITHUB_COMMENT"}

def template(task, actor):
    validate_task(task)
    if actor not in ACTORS:
        raise ValueError("Only ROY and JJANGGU review templates are supported")
    return (f"<!-- JJOONI-COLLAB-V2 task={task['task_id']} actor={actor} "
            f"kind=review head={task['head_sha']} -->\n"
            f"## {actor} / COLLAB REVIEW\n\n"
            "Verdict: [PASS / BLOCKED / NEEDS_DATA]\n"
            "Evidence: [real reproducible source and test result, or UNKNOWN]\n"
            "Risk: [one or more specific issues]\n"
            "Recommendation: [read-only recommendation; NO ORDERS/DEPLOY]\n"
            "Session evidence: [verified authenticated agent session reference or UNKNOWN]\n")

def main(argv=None):
    parser = argparse.ArgumentParser(description="Read-only three-agent PR collaboration tracker")
    parser.add_argument("command", choices=("status", "template"))
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--comments", type=Path)
    parser.add_argument("--actor", choices=ACTORS)
    args = parser.parse_args(argv)
    try:
        task = validate_task(json.loads(args.task.read_text(encoding="utf-8")))
        if args.command == "template":
            if not args.actor:
                parser.error("--actor required for template")
            print(template(task, args.actor))
        else:
            if not args.comments:
                parser.error("--comments required for status")
            comments = json.loads(args.comments.read_text(encoding="utf-8"))
            print(json.dumps(summarize(task, comments), ensure_ascii=False, indent=2))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        parser.error(str(exc))

if __name__ == "__main__":
    main()
