"""TEST-ONLY: fail-closed owner PR-opened relay candidate gate.

No GitHub I/O, permission changes, PR creation, deployment or trading.
All input evidence must also be independently authenticated by the caller.
CANDIDATE_ONLY and ALIAS_HEAD_VERIFIED NEVER grant permission to write.
"""
import re

REPO = "mauveplace/jjooni-control-tower"
OWNER = "mauveplace"
CONTRACT_NAME = "AI Collaboration Read-Only Contract"
CONTRACT_PATH = ".github/workflows/ai-collab-contract.yml"
# Verified against real GitHub Actions run 43417762051. Workflow can change.
CONTRACT_WORKFLOW_ID = 411466939
SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
TASK_RE = re.compile(r"D-[0-9]{6}-[A-Z0-9-]+\Z")
TASK_PATH = re.compile(r"ai-collab-dispatch/tasks/(D-[0-9]{6}-[A-Z0-9-]+)\.json\Z")


def blocked(reason):
    return {"decision": "BLOCKED", "reason": reason,
            "write_authorized": False, "merge_allowed": False,
            "deploy_allowed": False, "roy_execution_confirmed": False}


def _obj(x):
    return x if isinstance(x, dict) else {}


def _positive_int(x):
    return type(x) is int and x > 0


def _safe_path(p):
    if not isinstance(p, str) or not p or "\\" in p or p.startswith("/"):
        return False
    return all(segment not in ("", ".", "..") for segment in p.split("/"))


def _owner_pr(pr, *, require_opt_in=True):
    if not isinstance(pr, dict):
        return False
    head = _obj(pr.get("head"))
    base = _obj(pr.get("base"))
    author = _obj(pr.get("user"))
    repo = _obj(head.get("repo"))
    return (
        _positive_int(pr.get("number"))
        and pr.get("state") == "open"
        and pr.get("draft") is False
        and pr.get("merged") is False
        and (not require_opt_in or "[AI-COLLAB]" in str(pr.get("title", "")))
        and base.get("ref") == "main"
        and author.get("login") == OWNER
        and head.get("ref") is not None
        and isinstance(head.get("ref"), str)
        and head["ref"].startswith("experiment/ai-collab-")
        and repo.get("full_name") == REPO
        and SHA_RE.fullmatch(str(head.get("sha", ""))) is not None
    )


def _candidate(original_pr, task, first_review, correction_commit, green_ci,
               changed_pr_files, existing_relays, external_owner_approval):
    if external_owner_approval is not True:
        return blocked("Missing separately authenticated exact-boolean owner approval")
    if any(not isinstance(x, dict) for x in (
            original_pr, task, first_review, correction_commit, green_ci)):
        return blocked("Missing source object")
    if not isinstance(changed_pr_files, list) or not isinstance(existing_relays, list):
        return blocked("Missing changed-file or complete durable relay ledger")
    if not _owner_pr(original_pr):
        return blocked("Original PR not an authenticated open owner same-repo opt-in")
    num = original_pr["number"]
    sha = _obj(original_pr["head"])["sha"]
    task_id = task.get("task_id")
    reviewers = task.get("required_reviewers")
    if (not TASK_RE.fullmatch(str(task_id))
            or task.get("repository") != REPO or task.get("base_branch") != "main"
            or task.get("mode") != "SYSTEM_REVIEW_ONLY"
            or task.get("release_gate") != "USER_APPROVAL_REQUIRED"
            or task.get("auto_roy_review_after_ci") is not True
            or not isinstance(reviewers, list)
            or not all(isinstance(x, str) for x in reviewers)
            or reviewers.count("ROY") != 1):
        return blocked("Task does not opt into E2 with ROY and owner release gate")

    # Entire PR diff must be current/verified and must include ONE active task.
    if any(not isinstance(f, dict) or not _safe_path(f.get("filename"))
           for f in changed_pr_files):
        return blocked("Invalid changed-file path/type")
    if any(not (f["filename"].startswith("ai-collab/")
                or f["filename"].startswith("ai-collab-dispatch/"))
           for f in changed_pr_files):
        return blocked("Out-of-scope PR path")
    task_changes = [f for f in changed_pr_files
                    if TASK_PATH.fullmatch(f["filename"])]
    if (len(task_changes) != 1
            or TASK_PATH.fullmatch(task_changes[0]["filename"]).group(1) != task_id
            or task_changes[0].get("status") not in ("added", "modified")):
        return blocked("Exactly one active task JSON and no other task changes allowed")

    prior = first_review.get("head_sha")
    if (not _positive_int(first_review.get("pr_number"))
            or first_review["pr_number"] != num
            or first_review.get("task_id") != task_id
            or first_review.get("verdict") != "NEEDS_CHANGES"
            or first_review.get("stage") != "review"
            or first_review.get("verified_first_party") is not True
            or not _positive_int(first_review.get("comment_id"))
            or not SHA_RE.fullmatch(str(prior))
            or prior == sha):
        return blocked("First ROY NEEDS_CHANGES provenance or previous SHA mismatch")
    # Count all authenticated ROY reviews for this original PR and every
    # alias of the same task, including closed aliases and previous HEADs.
    if (not _positive_int(first_review.get("total_verified_reviews"))
            or first_review["total_verified_reviews"] != 1):
        return blocked("Second review budget is exhausted or not verified")

    parents = correction_commit.get("parents")
    files = correction_commit.get("files")
    if (correction_commit.get("sha") != sha
            or not isinstance(parents, list) or len(parents) != 1
            or not isinstance(parents[0], dict)
            or parents[0].get("sha") != prior
            or not isinstance(files, list) or len(files) != 1
            or not isinstance(files[0], dict)):
        return blocked("Correction is not a single-parent/single-file change")
    changed = files[0]
    filename = changed.get("filename")
    if (not _safe_path(filename)
            or not filename.startswith("ai-collab/")
            or filename.startswith("ai-collab/tests/")
            or filename == "ai-collab/owner_pr_relay_gate.py"
            or changed.get("status") != "modified"
            or filename not in [f["filename"] for f in changed_pr_files]):
        return blocked("Correction file must be safe source and present in PR diff")

    app_slug = _obj(green_ci.get("app")).get("slug")
    if (not _positive_int(green_ci.get("id"))
            or not _positive_int(green_ci.get("run_attempt"))
            or green_ci.get("workflow_id") != CONTRACT_WORKFLOW_ID
            or green_ci.get("name") != CONTRACT_NAME
            or green_ci.get("path") != CONTRACT_PATH
            or green_ci.get("event") != "pull_request"
            or green_ci.get("status") != "completed"
            or green_ci.get("conclusion") != "success"
            or green_ci.get("head_sha") != sha
            or _obj(green_ci.get("repository")).get("full_name") != REPO
            or _obj(green_ci.get("head_repository")).get("full_name") != REPO
            or app_slug not in (None, "github-actions")):
        return blocked("Exact current-head official CI run is unverified")
    # GitHub workflow_run REST can have no 'app' field. The independently
    # fetched run ID/path/workflow_id and repo/sha must be verified externally.

    for relay in existing_relays:
        if not isinstance(relay, dict):
            return blocked("Malformed relay ledger")
        src = relay.get("source_pr")
        if not _positive_int(src) or not TASK_RE.fullmatch(str(relay.get("task_id"))):
            return blocked("Invalid relay identity/type")
        # Never open two relays for the same original PR+task, even if an
        # earlier alias is now closed or has a different HEAD.
        if src == num and relay.get("task_id") == task_id:
            return blocked("Relay exists for original PR+task (any HEAD)")
    return {
        **blocked("Evidence candidate only, never a GitHub write authorization"),
        "decision": "CANDIDATE_ONLY", "source_pr": num, "task_id": task_id,
        "head_sha": sha, "read_only": True,
        "relay_identity": f"{REPO}:{num}:{task_id}:{sha}:final",
    }


def candidate_relay(original_pr, task, first_review, correction_commit,
                    green_ci, changed_pr_files, existing_relays,
                    *, external_owner_approval=False):
    try:
        return _candidate(original_pr, task, first_review, correction_commit,
                          green_ci, changed_pr_files, existing_relays,
                          external_owner_approval)
    except (TypeError, ValueError, IndexError, KeyError, AttributeError):
        return blocked("Malformed untrusted input evidence")


def verify_opened_alias(original_pr, alias_pr, *, expected_original_pr,
                        expected_task_id, expected_head_sha):
    """Post-create pairing audit, not proof of an authentic Claude Routine."""
    try:
        if (not _owner_pr(original_pr)
                or not _owner_pr(alias_pr)
                or not _positive_int(expected_original_pr)
                or original_pr["number"] != expected_original_pr
                or not TASK_RE.fullmatch(str(expected_task_id))
                or not SHA_RE.fullmatch(str(expected_head_sha))):
            return blocked("Invalid original, relay or immutable reference")
        a, b = _obj(original_pr["head"]), _obj(alias_pr["head"])
        if (alias_pr["number"] == original_pr["number"]
                or a.get("sha") != expected_head_sha
                or b.get("sha") != expected_head_sha
                or a.get("ref") == b.get("ref")):
            return blocked("Alias cannot be a different SHA or identical branch ref")
        return {**blocked("HEAD pairing verified but ROY delivery not authenticated"),
                "decision": "ALIAS_HEAD_VERIFIED",
                "source_pr": expected_original_pr,
                "relay_pr": alias_pr["number"],
                "head_sha": expected_head_sha,
                "task_id": expected_task_id}
    except (TypeError, ValueError, IndexError, KeyError, AttributeError):
        return blocked("Malformed alias metadata")
