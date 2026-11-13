import base64
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ci_roy_followup import (
    REPO, WORKFLOW, ISSUE_MARKER, TITLE_PREFIX,
    authorized_task, event_is_eligible, issue_matches, make_issue,
    parse_roy_comment, try_dispatch,
)

PARENT = "a" * 40
HEAD = "b" * 40
TASK_ID = "D-261113-L2-CI-DISPATCH-035"
TASK_PATH = "ai-collab-dispatch/tasks/" + TASK_ID + ".json"


def sample_event(conclusion="success"):
    return {
        "action": "completed",
        "repository": {"full_name": REPO},
        "workflow_run": {
            "id": 77, "name": WORKFLOW, "event": "pull_request",
            "status": "completed", "conclusion": conclusion,
            "head_sha": HEAD, "head_repository": {"full_name": REPO},
            "pull_requests": [{"number": 430}],
        },
    }


def sample_comment(app="claude", verdict="NEEDS_CHANGES", head=PARENT):
    return {
        "id": 42,
        "performed_via_github_app": {"slug": app},
        "body": "<!-- JJOONI-COLLAB-V4 task=" + TASK_ID
                + " actor=ROY stage=review head=" + head
                + " -->\n## ROY / REVIEW\n\nROY_REVIEW=" + verdict,
    }


def task_data():
    return {
        "task_id": TASK_ID, "repository": REPO, "base_branch": "main",
        "mode": "SYSTEM_REVIEW_ONLY",
        "required_reviewers": ["ROY"],
        "release_gate": "USER_APPROVAL_REQUIRED",
    }


class FakeGitHub:
    def __init__(self):
        self.created = []
        self.issues = [
            {"number": 330, "title": "[AI-COLLAB][ROY-REQUEST] old review",
             "body": "Progress note mentions " + TASK_ID + " and " + HEAD}
        ]
        self.comments = [sample_comment()]
        self.pr = {
            "number": 430, "state": "open", "draft": False, "merged": False,
            "title": "[AI-COLLAB] isolated",
            "base": {"ref": "main"},
            "head": {"sha": HEAD, "ref": "experiment/ai-collab-fixture",
                     "repo": {"full_name": REPO}},
        }

    def api(self, suffix):
        if suffix == "/actions/runs/77":
            return {"head_sha": HEAD, "conclusion": "success",
                    "event": "pull_request", "name": WORKFLOW}
        if suffix == "/commits/" + HEAD + "/pulls":
            return [{"number": 430}]
        if suffix == "/pulls/430":
            return self.pr
        if suffix == "/contents/" + TASK_PATH + "?ref=" + HEAD:
            encoded = base64.b64encode(json.dumps(task_data()).encode("utf-8"))
            return {"content": encoded.decode("ascii")}
        if suffix == "/commits/" + HEAD:
            return {
                "parents": [{"sha": PARENT}],
                "files": [{"filename": "ai-collab/l2_direct_event_key.py",
                           "status": "modified"}],
            }
        raise AssertionError("Unexpected API: " + suffix)

    def pages(self, suffix):
        if suffix == "/pulls/430/files":
            return [
                {"filename": TASK_PATH, "status": "added"},
                {"filename": "ai-collab/l2_direct_event_key.py", "status": "added"},
                {"filename": "ai-collab/tests/test_l2_direct_event_key.py",
                 "status": "added"},
            ]
        if suffix == "/issues/430/comments":
            return self.comments
        if suffix == "/issues?state=all&sort=created&direction=desc":
            return self.issues
        raise AssertionError("Unexpected pages: " + suffix)

    def request(self, uri, payload=None):
        self.created.append(payload)
        issue = {"number": 431, "title": payload["title"],
                 "body": payload["body"], "html_url": "https://github.com/example/431"}
        self.issues.insert(0, issue)
        return issue


class CIDispatchTests(unittest.TestCase):
    def test_trusted_success_event(self):
        self.assertTrue(event_is_eligible(sample_event()))

    def test_failed_workflow_is_not_authorized(self):
        self.assertFalse(event_is_eligible(sample_event("failure")))

    def test_non_pr_ci_does_not_trigger(self):
        event = sample_event()
        event["workflow_run"]["event"] = "push"
        self.assertFalse(event_is_eligible(event))

    def test_foreign_head_repo_rejected(self):
        event = sample_event()
        event["workflow_run"]["head_repository"]["full_name"] = "attacker/fork"
        self.assertFalse(event_is_eligible(event))

    def test_unapproved_future_task_rejected(self):
        data = task_data()
        self.assertFalse(authorized_task(data, "D-261113-OTHER-036", 431))
        data["task_id"] = "D-261113-OTHER-036"
        self.assertFalse(authorized_task(data, "D-261113-OTHER-036", 431))
        data["auto_roy_review_after_ci"] = True
        self.assertTrue(authorized_task(data, "D-261113-OTHER-036", 431))

    def test_migration_task_specific_pr_only(self):
        data = task_data()
        self.assertTrue(authorized_task(data, TASK_ID, 430))
        self.assertFalse(authorized_task(data, TASK_ID, 429))

    def test_release_gate_mandatory(self):
        data = task_data()
        data["release_gate"] = "AUTO_MERGE"
        self.assertFalse(authorized_task(data, TASK_ID, 430))

    def test_valid_github_claude_legacy_review(self):
        evidence = parse_roy_comment(sample_comment())
        self.assertEqual(evidence["verdict"], "NEEDS_CHANGES")
        self.assertEqual(evidence["head"], PARENT)

    def test_claude_app_provenance_not_claimed_from_marker(self):
        self.assertIsNone(parse_roy_comment(sample_comment(app="chatgpt-codex-connector")))
        self.assertIsNone(parse_roy_comment(sample_comment(app=None)))

    def test_quoted_review_not_counted(self):
        c = sample_comment()
        c["body"] = c["body"].replace("ROY_REVIEW=NEEDS_CHANGES", "> ROY_REVIEW=NEEDS_CHANGES")
        self.assertIsNone(parse_roy_comment(c))

    def test_duplicate_conflicting_head_rejected(self):
        c = sample_comment()
        c["body"] = c["body"].replace("actor=ROY ", "actor=ROY head=" + HEAD + " ")
        self.assertIsNone(parse_roy_comment(c))

    def test_issue_exact_match_and_false_positive(self):
        req = make_issue(430, TASK_ID, HEAD, 77, 42)
        self.assertTrue(issue_matches(req, 430, TASK_ID, HEAD))
        self.assertFalse(issue_matches(req, 430, TASK_ID, PARENT))
        unrelated = {"title": "[AI-COLLAB][ROY-REQUEST] old review",
                     "body": "incident log " + TASK_ID + " " + HEAD}
        self.assertFalse(issue_matches(unrelated, 430, TASK_ID, HEAD))

    def test_issue_request_is_strict_read_only(self):
        issue = make_issue(430, TASK_ID, HEAD, 77, 42)
        self.assertTrue(issue["body"].startswith(ISSUE_MARKER + "\n"))
        self.assertIn("Mode: SYSTEM_REVIEW_ONLY", issue["body"])
        self.assertIn("Release gate: USER_APPROVAL_REQUIRED", issue["body"])

    def test_end_to_end_created_once_then_deduped(self):
        gh = FakeGitHub()
        self.assertEqual(try_dispatch(gh, sample_event()), "CREATED")
        self.assertEqual(len(gh.created), 1)
        self.assertEqual(try_dispatch(gh, sample_event()), "DEDUPED")
        self.assertEqual(len(gh.created), 1)

    def test_source_must_be_first_review_on_parent_sha(self):
        gh = FakeGitHub()
        gh.comments = [sample_comment(head=HEAD)]
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertEqual(len(gh.created), 0)

    def test_never_request_third_review(self):
        gh = FakeGitHub()
        gh.comments.append(sample_comment(verdict="PASS", head=HEAD))
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertEqual(len(gh.created), 0)

    def test_stale_pr_does_not_create_issue(self):
        gh = FakeGitHub()
        gh.pr["head"]["sha"] = PARENT
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertEqual(len(gh.created), 0)

    def test_unauthorized_helper_path_not_written_or_dispatched(self):
        gh = FakeGitHub()
        original = gh.api
        def evil_api(suffix):
            if suffix == "/commits/" + HEAD:
                return {"parents": [{"sha": PARENT}],
                        "files": [{"filename": ".github/workflows/deploy.yml",
                                   "status": "modified"}]}
            return original(suffix)
        gh.api = evil_api
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertFalse(gh.created)


if __name__ == "__main__":
    unittest.main()
