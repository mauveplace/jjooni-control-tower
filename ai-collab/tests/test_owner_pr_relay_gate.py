import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from owner_pr_relay_gate import candidate_relay, verify_opened_alias, REPO

OLD = "a"*40
NEW = "b"*40
TASK = "D-261113-E2-RELAY-GATE-042"
PR = 505
TASK_PATH = "ai-collab-dispatch/tasks/" + TASK + ".json"


def fixture():
    original = {
        "number": PR, "state": "open", "draft": False, "merged": False,
        "title": "[AI-COLLAB] isolated corrected test", "base": {"ref": "main"},
        "head": {"sha": NEW, "ref": "experiment/ai-collab-e2-gate",
                 "repo": {"full_name": REPO}},
    }
    task = {
        "task_id": TASK, "repository": REPO, "base_branch": "main",
        "mode": "SYSTEM_REVIEW_ONLY", "release_gate": "USER_APPROVAL_REQUIRED",
        "auto_roy_review_after_ci": True, "required_reviewers": ["ROY"],
    }
    review = {
        "pr_number": PR, "task_id": TASK, "head_sha": OLD,
        "stage": "review", "verdict": "NEEDS_CHANGES",
        "verified_first_party": True, "comment_id": 101,
        "total_verified_reviews": 1,
    }
    correction = {
        "sha": NEW, "parents": [{"sha": OLD}],
        "files": [{"filename": "ai-collab/l2_direct_event_key.py",
                   "status": "modified"}],
    }
    ci = {
        "name": "AI Collaboration Read-Only Contract",
        "path": ".github/workflows/ai-collab-contract.yml",
        "event": "pull_request", "status": "completed", "conclusion": "success",
        "head_sha": NEW, "repository": {"full_name": REPO},
        "head_repository": {"full_name": REPO},
    }
    changed = [
        {"filename": TASK_PATH, "status": "added"},
        {"filename": "ai-collab/l2_direct_event_key.py", "status": "modified"},
        {"filename": "ai-collab/tests/test_l2_direct_event_key.py", "status": "added"},
    ]
    relays = []
    return [original, task, review, correction, ci, changed, relays]


def decide(args, approved=True):
    return candidate_relay(*args, external_owner_approval=approved)


class OwnerRelayGateTests(unittest.TestCase):
    def test_exact_head_candidate_has_no_write_or_merge_permission(self):
        result = decide(fixture())
        self.assertEqual(result["decision"], "CANDIDATE_ONLY")
        self.assertFalse(result["write_authorized"])
        self.assertFalse(result["merge_allowed"])
        self.assertFalse(result["roy_execution_confirmed"])
        self.assertIn(f":{PR}:{TASK}:{NEW}:final", result["relay_identity"])

    def test_explicit_external_owner_approval_required(self):
        self.assertEqual(decide(fixture(), False)["decision"], "BLOCKED")

    def test_missing_source_objects_fail_closed(self):
        for index in range(5):
            with self.subTest(index=index):
                args = fixture()
                args[index] = None
                self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_old_head_and_stale_review_fail_closed(self):
        args = fixture(); args[0]["head"]["sha"] = OLD
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[2]["head_sha"] = NEW
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_roy_verified_review_and_bounded_review_count(self):
        for key, value in (("verdict", "PASS"), ("stage", "final-review"),
                           ("verified_first_party", False),
                           ("total_verified_reviews", 2),
                           ("total_verified_reviews", True),
                           ("comment_id", -1)):
            with self.subTest(key=key, val=value):
                args = fixture(); args[2][key] = value
                self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_wrong_pr_sender_and_fork_rejected(self):
        for fld, value in (("state", "closed"), ("draft", True),
                           ("merged", True), ("title", "routine review")):
            args = fixture(); args[0][fld] = value
            self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[0]["head"]["repo"]["full_name"] = "attacker/fork"
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_explicit_e2_task_opt_in_and_release_gate(self):
        for key, value in (("auto_roy_review_after_ci", False),
                           ("release_gate", "AUTO_MERGE"),
                           ("mode", "PR_BRANCH_EDIT_APPROVED"),
                           ("required_reviewers", [])):
            args = fixture(); args[1][key] = value
            self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_ci_wrong_run_or_stale_sha_rejected(self):
        for key,value in (("conclusion","failure"),("event","push"),
                          ("head_sha",OLD),("status","in_progress"),
                          ("path",".github/workflows/other.yml")):
            with self.subTest(field=key):
                args = fixture(); args[4][key] = value
                self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_one_real_source_change_from_reviewed_parent(self):
        args = fixture(); args[3]["parents"] = [{"sha": "c"*40}]
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[3]["files"][0]["filename"] = "ai-collab/tests/test_bug.py"
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[3]["files"].append({"filename":"ai-collab/extra.py","status":"modified"})
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[3]["files"][0]["status"] = "added"
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_changed_diff_must_include_exact_one_task(self):
        args = fixture(); args[5][0]["filename"] = "ai-collab-dispatch/tasks/D-261113-OTHER-999.json"
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[5].append({"filename":TASK_PATH,"status":"modified"})
        self.assertEqual(decide(args)["decision"], "BLOCKED")
        args = fixture(); args[5].append({"filename":"production/index.js","status":"modified"})
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_duplicate_relay_even_closed_is_rejected(self):
        args = fixture(); args[6].append(
            {"source_pr": PR, "task_id": TASK, "head_sha": NEW, "state": "closed"}
        )
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_invalid_relay_ledger_rejected(self):
        args = fixture(); args[6].append("not an issue object")
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_alias_exact_sha_same_repo_different_ref(self):
        original = fixture()[0]
        alias = copy.deepcopy(original)
        alias["number"] = 506
        alias["head"]["ref"] = "experiment/ai-collab-e2-gate-alias"
        result = verify_opened_alias(original, alias, expected_original_pr=PR,
                                     expected_task_id=TASK, expected_head_sha=NEW)
        self.assertEqual(result["decision"], "ALIAS_HEAD_VERIFIED")
        self.assertFalse(result["merge_allowed"])
        self.assertFalse(result["roy_execution_confirmed"])

    def test_alias_changed_sha_fork_and_same_ref_fail_closed(self):
        original = fixture()[0]
        for key, value in (("sha",OLD),("ref",original["head"]["ref"])):
            alias = copy.deepcopy(original)
            alias["number"] = 506
            alias["head"][key] = value
            self.assertEqual(verify_opened_alias(
                original, alias, expected_original_pr=PR,
                expected_task_id=TASK, expected_head_sha=NEW)["decision"], "BLOCKED")
        alias = copy.deepcopy(original); alias["number"] = 506
        alias["head"]["ref"] = "experiment/ai-collab-e2-gate-alias"
        alias["head"]["repo"]["full_name"] = "attacker/fork"
        self.assertEqual(verify_opened_alias(
            original, alias, expected_original_pr=PR,
            expected_task_id=TASK, expected_head_sha=NEW)["decision"], "BLOCKED")

    def test_no_real_code_correction_cannot_issue_alias(self):
        args = fixture()
        args[3]["sha"] = OLD
        self.assertEqual(decide(args)["decision"], "BLOCKED")

    def test_no_third_roy_review(self):
        args = fixture()
        args[2]["total_verified_reviews"] = 2
        self.assertEqual(decide(args)["decision"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()
