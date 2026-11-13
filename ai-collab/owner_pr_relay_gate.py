"""Owner-created PR.opened relay: isolated, fail-closed deterministic CANDIDATE gate.

This module is NOT imported by the production dispatcher or Work/Claude Routines.
A CANDIDATE is not an instruction to create a GitHub PR. The caller must
independently authenticate all sources, obtain owner write authorization,
and repeat the current-head checks immediately before the write.
"""
import re

REPO = "mauveplace/jjooni-control-tower"
CONTRACT_NAME = "AI Collaboration Read-Only Contract"
CONTRACT_PATH = ".github/workflows/ai-collab-contract.yml"
SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
TASK_RE = re.compile(r"D-[0-9]{6}-[A-Z0-9-]+\Z")
TASK_PATH = re.compile(r"ai-collab-dispatch/tasks/(D-[0-9]{6}-[A-Z0-9-]+)\.json\Z")


def blocked(reason):
    return {
        "decision": "BLOCKED",
        "reason": reason,
        "write_authorized": False,
        "merge_allowed": False,
        "deploy_allowed": False,
        "roy_execution_confirmed": False,
    }


def candidate_relay(original_pr, task, first_review, correction_commit,
                    green_ci, changed_pr_files, existing_relays,
                    *, external_owner_approval=False):
    """Evaluate exact-head potential. Does NOT open a branch or PR.

    Original objects must come from separately validated GitHub/Claude sources.
    Never pass fields from an untrusted PR document as external_owner_approval
    or as first_review.verified_first_party.
    """
    if not external_owner_approval:
        return blocked("No independently authenticated owner approval for this experiment")
    if any(not isinstance(o, dict) for o in (
        original_pr, task, first_review, correction_commit, green_ci
    )):
        return blocked("Missing verified source objects")
    if not isinstance(changed_pr_files, list) or not isinstance(existing_relays, list):
        return blocked("Incomplete change or dedup evidence")
    number = original_pr.get("number")
    head = original_pr.get("head") or {}
    base = original_pr.get("base") or {}
    sha = head.get("sha")
    if (type(number) is not int or number <= 0
            or original_pr.get("state") != "open"
            or original_pr.get("draft") is True
            or original_pr.get("merged") is True
            or "[AI-COLLAB]" not in str(original_pr.get("title", ""))
            or base.get("ref") != "main"
            or (head.get("repo") or {}).get("full_name") != REPO
            or not str(head.get("ref", "")).startswith("experiment/ai-collab-")
            or not SHA_RE.fullmatch(str(sha))):
        return blocked("Original PR is not an eligible current same-repo opt-in")
    task_id = task.get("task_id")
    if (not TASK_RE.fullmatch(str(task_id))
            or task.get("repository") != REPO or task.get("base_branch") != "main"
            or task.get("mode") != "SYSTEM_REVIEW_ONLY"
            or task.get("release_gate") != "USER_APPROVAL_REQUIRED"
            or task.get("auto_roy_review_after_ci") is not True
            or "ROY" not in (task.get("required_reviewers") or [])):
        return blocked("Task lacks explicit E2 opt-in / read-only release gate")
    if any(not isinstance(f, dict) or not isinstance(f.get("filename"), str)
           for f in changed_pr_files):
        return blocked("Unverified PR changed-file list")
    paths = [f["filename"] for f in changed_pr_files]
    if any(not (p.startswith("ai-collab/") or
                p.startswith("ai-collab-dispatch/")) for p in paths):
        return blocked("Out-of-scope PR source")
    tasks = [f for f in changed_pr_files
             if TASK_PATH.fullmatch(f["filename"])
             and f.get("status") in ("added", "modified")]
    if len(tasks) != 1 or TASK_PATH.fullmatch(tasks[0]["filename"]).group(1) != task_id:
        return blocked("Exactly one matching changed task JSON required")
    prior = first_review.get("head_sha")
    if (first_review.get("pr_number") != number
            or first_review.get("task_id") != task_id
            or first_review.get("verdict") != "NEEDS_CHANGES"
            or first_review.get("stage") != "review"
            or first_review.get("verified_first_party") is not True
            or type(first_review.get("comment_id")) is not int
            or first_review["comment_id"] <= 0
            or not SHA_RE.fullmatch(str(prior))
            or prior == sha):
        return blocked("No authenticated first ROY NEEDS_CHANGES on previous head")
    if type(first_review.get("total_verified_reviews")) is not int \
            or first_review["total_verified_reviews"] != 1:
        return blocked("Review budget must show exactly one authenticated review")
    parents = correction_commit.get("parents") or []
    files = correction_commit.get("files") or []
    if (correction_commit.get("sha") != sha
            or len(parents) != 1 or (parents[0] or {}).get("sha") != prior
            or len(files) != 1 or not isinstance(files[0], dict)
            or files[0].get("status") != "modified"
            or not str(files[0].get("filename", "")).startswith("ai-collab/")
            or str(files[0].get("filename", "")).startswith("ai-collab/tests/")):
        return blocked("One non-test source-file correction from reviewed parent required")
    if (green_ci.get("name") != CONTRACT_NAME
            or green_ci.get("path") != CONTRACT_PATH
            or green_ci.get("event") != "pull_request"
            or green_ci.get("status") != "completed"
            or green_ci.get("conclusion") != "success"
            or green_ci.get("head_sha") != sha
            or (green_ci.get("repository") or {}).get("full_name") != REPO
            or (green_ci.get("head_repository") or {}).get("full_name") != REPO):
        return blocked("No verified exact-head green contract CI")
    for relay in existing_relays:
        if not isinstance(relay, dict):
            return blocked("Invalid prior relay ledger")
        if (relay.get("source_pr") == number and relay.get("task_id") == task_id
                and relay.get("head_sha") == sha):
            return blocked("Relay already exists for this exact task and HEAD")
    return {
        **blocked("Gate satisfied, but external owner transaction and re-check still needed"),
        "decision": "CANDIDATE_ONLY",
        "source_pr": number,
        "task_id": task_id,
        "head_sha": sha,
        "relay_identity": f"{REPO}:{number}:{task_id}:{sha}:final",
        "read_only": True,
    }


def verify_opened_alias(original_pr, alias_pr, *, expected_original_pr,
                        expected_task_id, expected_head_sha):
    """Post-create audit; never turns a PR-opened event into merge authority."""
    if any(not isinstance(o, dict) for o in (original_pr, alias_pr)):
        return blocked("Missing fetched PR objects")
    if (original_pr.get("number") != expected_original_pr
            or type(expected_original_pr) is not int or expected_original_pr <= 0
            or not TASK_RE.fullmatch(str(expected_task_id))
            or not SHA_RE.fullmatch(str(expected_head_sha))):
        return blocked("Invalid immutable reference")
    a, b = original_pr.get("head") or {}, alias_pr.get("head") or {}
    if (original_pr.get("state") != "open" or original_pr.get("merged") is True
            or alias_pr.get("state") != "open" or alias_pr.get("merged") is True
            or type(alias_pr.get("number")) is not int
            or alias_pr["number"] == original_pr["number"]
            or "[AI-COLLAB]" not in str(alias_pr.get("title", ""))
            or (alias_pr.get("base") or {}).get("ref") != "main"
            or a.get("sha") != expected_head_sha or b.get("sha") != expected_head_sha
            or a.get("ref") == b.get("ref")
            or (a.get("repo") or {}).get("full_name") != REPO
            or (b.get("repo") or {}).get("full_name") != REPO):
        return blocked("Alias PR does not match immutable original PR HEAD")
    return {
        **blocked("HEAD pairing verified; first-party ROY event still required"),
        "decision": "ALIAS_HEAD_VERIFIED",
        "source_pr": expected_original_pr,
        "relay_pr": alias_pr["number"],
        "head_sha": expected_head_sha,
        "task_id": expected_task_id,
    }
