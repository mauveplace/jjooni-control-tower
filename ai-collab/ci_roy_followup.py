#!/usr/bin/env python3
"""Default-branch CI success -> verified PR handoff comment for owner Work.

Github Actions GITHUB_TOKEN-created Issues cannot satisfy the existing Claude
owner-authored issues.opened trust contract. Never execute untrusted PR code.
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

REPO = "mauveplace/jjooni-control-tower"
WORKFLOW = "AI Collaboration Read-Only Contract"
ISSUE_MARKER = "<!-- JJOONI-COLLAB-ISSUE-V1 -->"
BRIDGE_MARKER = "JJOONI-CI-GREEN-ROY-HANDOFF-V1"
EXPECTED_CI_PATH = ".github/workflows/ai-collab-contract.yml"
TASK_FILE = re.compile(r"ai-collab-dispatch/tasks/(D-[0-9]{6}-[A-Z0-9-]+)\.json\Z")
SHA = re.compile(r"[a-f0-9]{40}\Z")
TITLE_PREFIX = "[AI-COLLAB][ROY-REQUEST] L2 CI success final review PR #"
# Approved existing isolated test PR, whose immutable task file lacks opt-in.
MIGRATION_EXCEPTIONS = {("D-261113-L2-CI-DISPATCH-035", 430)}


def event_is_eligible(event):
    run = event.get("workflow_run") or {}
    return (
        event.get("action") == "completed"
        and (event.get("repository") or {}).get("full_name") == REPO
        and run.get("name") == WORKFLOW
        and run.get("event") == "pull_request"
        and run.get("status") == "completed"
        and run.get("conclusion") == "success"
        and (run.get("head_repository") or {}).get("full_name") == REPO
        and bool(SHA.fullmatch(str(run.get("head_sha", ""))))
        and type(run.get("id")) is int
    )


def authorized_task(task, task_id, pr_number):
    if not isinstance(task, dict):
        return False
    return (
        task.get("task_id") == task_id
        and task.get("repository") == REPO
        and task.get("base_branch") == "main"
        and task.get("mode") == "SYSTEM_REVIEW_ONLY"
        and task.get("release_gate") == "USER_APPROVAL_REQUIRED"
        and "ROY" in (task.get("required_reviewers") or [])
        and (
            task.get("auto_roy_review_after_ci") is True
            or (task_id, pr_number) in MIGRATION_EXCEPTIONS
        )
    )


def parse_roy_comment(comment):
    """GitHub Claude-app PR conversation review, not a marker-only role claim."""
    app = comment.get("performed_via_github_app") or {}
    if app.get("slug") != "claude":
        return None
    body = comment.get("body") or ""
    first = body.splitlines()[0] if body else ""
    legacy = re.fullmatch(r"<!-- JJOONI-COLLAB-V4\s+(.+?) -->", first)
    modern = re.fullmatch(r"<!-- JJOONI-COLLAB-ROY-REVIEW-V4\s+(.+?) -->", first)
    m = legacy or modern
    if not m:
        return None
    raw = re.findall(r"([a-z][a-z_-]*)=([^\s>]+)", m.group(1))
    fields = dict(raw)
    if len(raw) != len(fields):
        return None
    if legacy and fields.get("actor") != "ROY":
        return None
    if fields.get("stage") not in ("review", "re-review", "final-review", "SYSTEM_REVIEW_ONLY"):
        return None
    head = fields.get("head", "")
    if not SHA.fullmatch(head):
        return None
    fenced = False
    verdicts = []
    for line in body.splitlines()[1:]:
        if line.lstrip().startswith(("~~~", chr(96) * 3)):
            fenced = not fenced
            continue
        if fenced or line.lstrip().startswith(">"):
            continue
        v = re.fullmatch(
            r"\s*(?:\*\*)?(?:\x60)?ROY_REVIEW=(PASS|NEEDS_CHANGES|BLOCKED)(?:\x60)?(?:\*\*)?\s*",
            line,
        )
        if v:
            verdicts.append(v.group(1))
    if len(verdicts) != 1:
        return None
    return {"task_id": fields.get("task"), "head": head,
            "verdict": verdicts[0], "comment_id": comment.get("id")}


def issue_matches(issue, number, task_id, head):
    if (issue.get("pull_request") or issue.get("title") != TITLE_PREFIX + str(number)
            or (issue.get("user") or {}).get("login") != "mauveplace"):
        return False
    body = (issue.get("body") or "").replace("\r\n", "\n")
    if not body.startswith(ISSUE_MARKER + "\n"):
        return False
    expected = {
        "Target-PR": str(number), "Task-ID": task_id,
        "Expected-HEAD": head, "Mode": "SYSTEM_REVIEW_ONLY",
        "Requested-By": "JJOONI",
    }
    for key, value in expected.items():
        found = re.findall(r"(?m)^" + re.escape(key) + r":[ \t]*(.*)$", body)
        if found != [value]:
            return False
    return True


def make_issue(number, task_id, head, run_id, source_comment_id):
    return {
        "title": TITLE_PREFIX + str(number),
        "body": "\n".join([
            ISSUE_MARKER,
            "Target-PR: " + str(number),
            "Task-ID: " + task_id,
            "Expected-HEAD: " + head,
            "Mode: SYSTEM_REVIEW_ONLY",
            "Requested-By: JJOONI",
            "Scope: Second and FINAL independent ROY read-only review of current HEAD, CI, unchanged tests and one corrected source file; no edits, merge, deploy or trading.",
            "",
            "Created by trusted default-branch CI green workflow_run. Do NOT infer release approval.",
            "Verified CI workflow_run ID: " + str(run_id),
            "Original Claude GitHub review comment ID: " + str(source_comment_id),
            "GitHub app corroborates Claude; Work commit author is not independently authenticated.",
            "ROY review budget: 2 maximum; this request is the second/final review.",
            "Release gate: USER_APPROVAL_REQUIRED.",
        ]),
    }


def make_bridge_comment(number, task_id, head, run_id, source_comment_id):
    return {
        "body": "\n".join([
            "<!-- %s task=%s pr=%s head=%s run=%s -->" %
                (BRIDGE_MARKER, task_id, number, head, run_id),
            "SOURCE=GITHUB_ACTIONS_CI_COMPLETED",
            "GitHub Actions verified exact green CI run, matching open PR/HEAD,",
            "one Claude-app NEEDS_CHANGES review on its parent, and one safe fix.",
            "Original Claude review comment ID: " + str(source_comment_id),
            "The connected JJOONI Work webhook MUST independently recheck CI and",
            "dedupe before creating ONE OWNER-AUTHORED read-only ROY Issue.",
            "This github-actions[bot] comment is NOT an owner review request.",
            "No main merge, deployment, trading or additional privileges."
        ])
    }


def bridge_matches(comment, number, task_id, head):
    if (comment.get("user") or {}).get("login") != "github-actions[bot]":
        return False
    first = (comment.get("body") or "").splitlines()
    if not first:
        return False
    pattern = (r"<!-- " + BRIDGE_MARKER + r" task=" + re.escape(task_id)
               + r" pr=" + str(number) + r" head=" + head
               + r" run=[1-9][0-9]* -->")
    return re.fullmatch(pattern, first[0]) is not None


class GitHub:
    def __init__(self, token):
        if not token:
            raise RuntimeError("GitHub token unavailable")
        self.token = token

    def request(self, uri, payload=None):
        url = "https://api.github.com" + uri
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + self.token,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "jjooni-ci-roy-followup",
        }
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        if data is not None:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers,
                                     method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError("GitHub HTTP %s at %s" % (exc.code, uri)) from None

    def api(self, suffix):
        return self.request("/repos/" + REPO + suffix)

    def pages(self, suffix, max_pages=10):
        rows = []
        for page in range(1, max_pages + 1):
            separator = "&" if "?" in suffix else "?"
            part = self.api(suffix + separator + "per_page=100&page=" + str(page))
            if not isinstance(part, list):
                raise RuntimeError("Invalid GitHub pagination response")
            rows.extend(part)
            if len(part) < 100:
                return rows
        raise RuntimeError("Pagination cap; refusing duplicate-risk issue write")


def candidate_prs(gh, run):
    sha = run["head_sha"]
    numbers = set()
    for item in run.get("pull_requests") or []:
        if type(item.get("number")) is int:
            numbers.add(item["number"])
    for item in gh.api("/commits/" + sha + "/pulls"):
        if type(item.get("number")) is int:
            numbers.add(item["number"])
    return sorted(numbers)


def try_dispatch(gh, event):
    if not event_is_eligible(event):
        print("SKIP: untrusted or unsuccessful workflow_run")
        return "SKIP"
    run = event["workflow_run"]
    sha = run["head_sha"]
    confirmed = gh.api("/actions/runs/" + str(run["id"]))
    if (confirmed.get("head_sha") != sha or confirmed.get("conclusion") != "success"
            or confirmed.get("event") != "pull_request"
            or confirmed.get("name") != WORKFLOW
            or confirmed.get("path") != EXPECTED_CI_PATH
            or (confirmed.get("head_repository") or {}).get("full_name") != REPO
            or (confirmed.get("repository") or {}).get("full_name") != REPO):
        raise RuntimeError("CI source mismatch")
    for number in candidate_prs(gh, run):
        pr = gh.api("/pulls/" + str(number))
        head = pr.get("head") or {}
        if (pr.get("state") != "open" or pr.get("draft") or pr.get("merged")
                or "[AI-COLLAB]" not in pr.get("title", "")
                or (pr.get("base") or {}).get("ref") != "main"
                or head.get("sha") != sha
                or (head.get("repo") or {}).get("full_name") != REPO
                or not head.get("ref", "").startswith("experiment/ai-collab-")):
            continue
        files = gh.pages("/pulls/" + str(number) + "/files")
        if any(not (f["filename"].startswith("ai-collab/")
                    or f["filename"].startswith("ai-collab-dispatch/"))
               for f in files):
            continue
        tasks = [f for f in files if TASK_FILE.fullmatch(f["filename"])
                 and f.get("status") in ("added", "modified")]
        if len(tasks) != 1:
            continue
        task_id = TASK_FILE.fullmatch(tasks[0]["filename"]).group(1)
        source = gh.api("/contents/" + tasks[0]["filename"] + "?ref=" + sha)
        task = json.loads(base64.b64decode(source["content"]).decode("utf-8"))
        if not authorized_task(task, task_id, number):
            continue
        commit = gh.api("/commits/" + sha)
        parents = commit.get("parents") or []
        changed = commit.get("files") or []
        if len(parents) != 1 or len(changed) != 1:
            continue
        previous = parents[0].get("sha")
        filename = changed[0].get("filename", "")
        if not (SHA.fullmatch(str(previous))
                and filename.startswith("ai-collab/")
                and not filename.startswith("ai-collab/tests/")
                and changed[0].get("status") == "modified"):
            continue
        comments = gh.pages("/issues/" + str(number) + "/comments")
        reviews = [r for c in comments if (r := parse_roy_comment(c))
                   and r["task_id"] == task_id]
        # One NEEDS_CHANGES already reviewed; NEVER dispatch third review.
        if len(reviews) != 1 or reviews[0]["head"] != previous \
                or reviews[0]["verdict"] != "NEEDS_CHANGES":
            continue
        issues = gh.pages("/issues?state=all&sort=created&direction=desc")
        if any(issue_matches(i, number, task_id, sha) for i in issues):
            print("DEDUPED: genuine owner ROY issue already exists")
            return "DEDUPED"
        if any(bridge_matches(c, number, task_id, sha) for c in comments):
            print("DEDUPED: CI-green bridge comment already exists")
            return "DEDUPED"
        fresh = gh.api("/pulls/" + str(number))
        if fresh.get("state") != "open" or (fresh.get("head") or {}).get("sha") != sha:
            print("STALE: PR changed before handoff comment")
            return "STALE"
        note = make_bridge_comment(number, task_id, sha, run["id"],
                                   reviews[0]["comment_id"])
        created = gh.request("/repos/" + REPO + "/issues/" +
                             str(number) + "/comments", note)
        if (type(created.get("id")) is not int
                or created.get("body") != note["body"]):
            raise RuntimeError("GitHub PR comment confirmation failed")
        print("BRIDGE_CREATED pr=%s comment=%s sha=%s url=%s" %
              (number, created["id"], sha, created.get("html_url")))
        return "BRIDGE_CREATED"
    print("NO_ELIGIBLE_PR: no authorized code correction to review")
    return "SKIP"


def main():
    path = os.environ.get("GITHUB_EVENT_PATH")
    if not path:
        raise RuntimeError("GITHUB_EVENT_PATH missing")
    with open(path, encoding="utf-8") as stream:
        event = json.load(stream)
    if not event_is_eligible(event):
        print("SKIP: event gate")
        return
    try_dispatch(GitHub(os.environ.get("GH_TOKEN")), event)


if __name__ == "__main__":
    try:
        main()
    except (KeyError, TypeError, ValueError, RuntimeError, urllib.error.URLError) as exc:
        print("BLOCKED: %s" % exc, file=sys.stderr)
        sys.exit(1)
