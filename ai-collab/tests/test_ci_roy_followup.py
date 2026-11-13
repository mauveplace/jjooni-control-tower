import base64
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ci_roy_followup import (
    REPO, WORKFLOW, ISSUE_MARKER, TITLE_PREFIX,
    authorized_task, event_is_eligible, issue_matches, make_issue,
    make_bridge_comment, bridge_matches, parse_roy_comment, try_dispatch,
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
                    "event": "pull_request", "name": WORKFLOW,
                    "path": ".github/workflows/ai-collab-contract.yml",
                    "repository": {"full_name": REPO},
                    "head_repository": {"full_name": REPO}}
        if suffix == "/commits/" + HEAD + "/pulls":
            return [{"number": 430}]
        if suffix == "/pulls/430":
            return self.pr
        if suffix == "/contents/" + TASK_PATH + "?ref=" + HEAD:
            encoded = base64.b64encode(json.dumps(task_data()).encode("utf-8"))
            return {"content": encoded.decode("ascii")}
        if suffix == "/issues?state=all&sort=created&direction=desc&per_page=100":
            return self.issues
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
        raise AssertionError("Unexpected pages: " + suffix)

    def request(self, uri, payload=None):
        if uri.startswith("/search/issues?") and payload is None:
            return {"total_count": len(self.issues), "items": self.issues}
        self.created.append(payload)
        if uri != "/repos/" + REPO + "/issues/430/comments":
            raise AssertionError("Unauthorized non-comment GitHub write: " + uri)
        comment = {"id": 431, "body": payload["body"],
                   "user": {"login": "github-actions[bot]"},
                   "html_url": "https://github.com/example/431"}
        self.comments.append(comment)
        return comment


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
        req["user"] = {"login": "mauveplace"}
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
        self.assertEqual(try_dispatch(gh, sample_event()), "BRIDGE_CREATED")
        self.assertEqual(len(gh.created), 1)
        self.assertTrue(bridge_matches(gh.comments[-1], 430, TASK_ID, HEAD))
        self.assertEqual(try_dispatch(gh, sample_event()), "DEDUPED")
        self.assertEqual(len(gh.created), 1)

    def test_actions_bot_cannot_impersonate_trusted_owner_issue(self):
        req = make_issue(430, TASK_ID, HEAD, 77, 42)
        req["user"] = {"login": "github-actions[bot]"}
        self.assertFalse(issue_matches(req, 430, TASK_ID, HEAD))
        req["user"]["login"] = "mauveplace"
        self.assertTrue(issue_matches(req, 430, TASK_ID, HEAD))

    def test_real_bridge_signal_has_strict_idempotency_scope(self):
        note = make_bridge_comment(430, TASK_ID, HEAD, 77, 42)
        bot = {"body": note["body"], "user": {"login": "github-actions[bot]"}}
        self.assertTrue(bridge_matches(bot, 430, TASK_ID, HEAD))
        self.assertFalse(bridge_matches(bot, 430, TASK_ID, PARENT))
        bot["user"]["login"] = "mauveplace"
        self.assertFalse(bridge_matches(bot, 430, TASK_ID, HEAD))

    def test_fake_roy_actor_and_modern_header(self):
        c = sample_comment()
        c["body"] = c["body"].replace("actor=ROY", "actor=JJOONI")
        self.assertIsNone(parse_roy_comment(c))
        good = sample_comment()
        good["body"] = good["body"].replace(
            "<!-- JJOONI-COLLAB-V4 ", "<!-- JJOONI-COLLAB-ROY-REVIEW-V4 "
        ).replace("actor=ROY ", "")
        self.assertEqual(parse_roy_comment(good)["verdict"], "NEEDS_CHANGES")

    def test_bot_ci_comment_does_not_authenticate_roy(self):
        c = sample_comment(app="github-actions")
        self.assertIsNone(parse_roy_comment(c))

    def test_run_api_wrong_path_fails_closed(self):
        gh = FakeGitHub()
        old_api = gh.api
        def wrong_path(suffix):
            x = old_api(suffix)
            if suffix == "/actions/runs/77":
                x["path"] = ".github/workflows/other.yml"
            return x
        gh.api = wrong_path
        with self.assertRaisesRegex(RuntimeError, "CI source mismatch"):
            try_dispatch(gh, sample_event())
        self.assertFalse(gh.created)

    def test_second_pr_file_task_contract_rejected(self):
        gh = FakeGitHub()
        old_pages = gh.pages
        def extra_contract(suffix):
            files = old_pages(suffix)
            if suffix == "/pulls/430/files":
                files.append({"filename": "ai-collab-dispatch/tasks/D-261113-EXTRA-123.json",
                              "status": "added"})
            return files
        gh.pages = extra_contract
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertFalse(gh.created)

    def test_commit_cannot_change_regression_tests(self):
        gh = FakeGitHub()
        old_api = gh.api
        def edited_tests(suffix):
            x = old_api(suffix)
            if suffix == "/commits/" + HEAD:
                x["files"][0]["filename"] = "ai-collab/tests/test_ci_roy_followup.py"
            return x
        gh.api = edited_tests
        self.assertEqual(try_dispatch(gh, sample_event()), "SKIP")
        self.assertFalse(gh.created)

    def test_true_stale_race_after_all_validation(self):
        gh = FakeGitHub()
        old_api = gh.api
        called = [0]
        def late_change(suffix):
            if suffix == "/pulls/430":
                called[0] += 1
                if called[0] == 2:
                    result = dict(gh.pr)
                    result["head"] = dict(gh.pr["head"], sha=PARENT)
                    return result
            return old_api(suffix)
        gh.api = late_change
        self.assertEqual(try_dispatch(gh, sample_event()), "STALE")
        self.assertFalse(gh.created)

    def test_owner_issue_dedup_not_blocked_by_bot_issue(self):
        gh = FakeGitHub()
        bot = make_issue(430, TASK_ID, HEAD, 77, 42)
        bot.update({"number": 432, "user": {"login": "github-actions[bot]"}})
        gh.issues.append(bot)
        self.assertEqual(try_dispatch(gh, sample_event()), "BRIDGE_CREATED")
        self.assertEqual(len(gh.created), 1)
        owner = make_issue(430, TASK_ID, HEAD, 77, 42)
        owner.update({"number": 433, "user": {"login": "mauveplace"}})
        gh.issues.append(owner)
        self.assertEqual(try_dispatch(gh, sample_event()), "DEDUPED")
        self.assertEqual(len(gh.created), 1)

    def test_search_catches_old_issue_missing_from_recent_page(self):
        gh = FakeGitHub()
        old_api = gh.api
        exact = make_issue(430, TASK_ID, HEAD, 77, 42)
        exact.update({"number": 100, "user": {"login": "mauveplace"}})
        gh.issues.append(exact)
        def empty_recent(suffix):
            if suffix == "/issues?state=all&sort=created&direction=desc&per_page=100":
                return []
            return old_api(suffix)
        gh.api = empty_recent
        self.assertEqual(try_dispatch(gh, sample_event()), "DEDUPED")
        self.assertEqual(len(gh.created), 0)

    def test_excessive_search_results_fail_closed(self):
        gh = FakeGitHub()
        old_request = gh.request
        def too_large(uri, payload=None):
            if uri.startswith("/search/issues?"):
                return {"total_count": 101, "items": []}
            return old_request(uri, payload)
        gh.request = too_large
        with self.assertRaisesRegex(RuntimeError, "Large Issue search"):
            try_dispatch(gh, sample_event())
        self.assertEqual(len(gh.created), 0)

    def test_receiver_contract_owner_issue_bridge(self):
        from issue_dispatch import decide
        req = make_issue(430, TASK_ID, HEAD, 77, 42)
        envelope = {
            "action": "opened", "repository": {"full_name": REPO},
            "sender": {"login": "mauveplace"},
            "issue": {"id": 100, "number": 431, "title": req["title"],
                      "body": req["body"], "user": {"login": "mauveplace"}},
        }
        target = {"number": 430, "title": "[AI-COLLAB] isolated", "state": "open",
                  "base": {"ref": "main"}, "head": {"sha": HEAD}}
        self.assertEqual(decide(envelope, target)["decision"], "REQUEST_ROY_REVIEW")
        envelope["issue"]["user"]["login"] = "github-actions[bot]"
        envelope["sender"]["login"] = "github-actions[bot]"
        self.assertEqual(decide(envelope, target)["decision"], "UNTRUSTED")

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
