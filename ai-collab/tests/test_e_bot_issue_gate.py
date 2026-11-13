"""Fail-closed E candidate gate security tests. No production routing."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from e_bot_issue_gate import decide_ci_bot_candidate, REPO, MARKER

H = "a" * 40
T = "D-261113-E-BOT-ISSUE-PROBE-039"
P = 9900
R = 733
C = 929

def fixture():
    marker = "<!-- JJOONI-CI-GREEN-ROY-HANDOFF-V1 task=" + T + " pr=" + str(P) + " head=" + H + " run=" + str(R) + " -->"
    issue = {
        "id": 999, "number": 1000, "title": "[AI-COLLAB][ROY-REQUEST] CI-green test",
        "user": {"login": "github-actions[bot]", "type": "Bot", "id": 41898282},
        # First-party GitHub REST Issue #438 has null performed_via_github_app.
        "performed_via_github_app": None,
        "body": MARKER + "\nTarget-PR: " + str(P) + "\nTask-ID: " + T +
                "\nExpected-HEAD: " + H + "\nCI-Run: " + str(R) +
                "\nSource-Comment: " + str(C) + "\nMode: SYSTEM_REVIEW_ONLY\nRequested-By: CI\n"
    }
    event = {"action": "opened", "repository": {"full_name": REPO},
             "sender": {"login": "github-actions[bot]", "id": 41898282}, "issue": issue}
    pr = {"number": P, "state": "open", "draft": False, "merged": False,
          "title": "[AI-COLLAB] E experiment", "base": {"ref": "main"},
          "head": {"sha": H, "ref": "experiment/ai-collab-e", "repo": {"full_name": REPO}}}
    comment = {"id": C, "user": {"login": "github-actions[bot]", "id": 41898282},
               "performed_via_github_app": None,
               "body": marker + "\nSOURCE=GITHUB_ACTIONS_CI_COMPLETED"}
    run = {"id": R, "name": "AI Collaboration Read-Only Contract",
           "path": ".github/workflows/ai-collab-contract.yml",
           "event": "pull_request", "status": "completed", "conclusion": "success",
           "head_sha": H, "repository": {"full_name": REPO},
           "head_repository": {"full_name": REPO}}
    task = {"task_id": T, "repository": REPO, "base_branch": "main",
            "mode": "SYSTEM_REVIEW_ONLY", "release_gate": "USER_APPROVAL_REQUIRED",
            "required_reviewers": ["ROY"], "auto_roy_review_after_ci": True}
    return [event, pr, comment, run, task]


class EBotIssueCandidateTests(unittest.TestCase):
    def verdict(self, parts):
        return decide_ci_bot_candidate(*parts)

    def test_valid_candidate_is_still_not_execution_permission(self):
        r = self.verdict(fixture())
        self.assertEqual(r["decision"], "CANDIDATE_READ_ONLY")
        self.assertFalse(r["execution_confirmed"])
        self.assertFalse(r["merge_allowed"])
        self.assertFalse(r["deploy_allowed"])

    def test_human_impersonating_bot_is_rejected(self):
        v = fixture(); v[0]["issue"]["user"]["type"] = "User"
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_foreign_issue_app_rejected(self):
        v = fixture(); v[0]["issue"]["performed_via_github_app"] = {"slug": "user-app"}
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_real_bot_issue_null_app_is_allowed_as_candidate_not_execution(self):
        v = fixture()
        self.assertIsNone(v[0]["issue"]["performed_via_github_app"])
        self.assertEqual(self.verdict(v)["decision"], "CANDIDATE_READ_ONLY")
        self.assertFalse(self.verdict(v)["issuer_run_verified"])

    def test_wrong_bot_numeric_id_rejected_even_with_bot_login(self):
        v = fixture(); v[0]["issue"]["user"]["id"] = 123456
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")
        v = fixture(); v[2]["user"]["id"] = 123456
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_invalid_bool_issue_id_rejected(self):
        v = fixture(); v[0]["issue"]["id"] = True
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")
        v = fixture(); v[0]["issue"]["id"] = 0
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_owner_marker_and_test_probe_marker_are_never_bot_review_requests(self):
        for m in ("<!-- JJOONI-COLLAB-ISSUE-V1 -->",
                  "<!-- JJOONI-COLLAB-CI-ISSUE-PROBE-V1 pr=9900 head=" + H + " -->"):
            with self.subTest(marker=m):
                v = fixture(); v[0]["issue"]["body"] = v[0]["issue"]["body"].replace(MARKER, m)
                self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_sender_mismatch_rejected(self):
        v = fixture(); v[0]["sender"]["login"] = "mauveplace"
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_stale_pr_head_rejected(self):
        v = fixture(); v[1]["head"]["sha"] = "b" * 40
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_fork_and_other_branch_rejected(self):
        for val in ("other/repo", None):
            with self.subTest(repo=val):
                v = fixture(); v[1]["head"]["repo"]["full_name"] = val
                self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_failed_ci_or_wrong_workflow_rejected(self):
        for key,value in (("conclusion","failure"),("path",".github/workflows/other.yml"),
                          ("event","push"),("head_sha","b"*40)):
            with self.subTest(field=key):
                v = fixture(); v[3][key] = value
                self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_fake_bot_comment_and_wrong_comment_id_rejected(self):
        for k,val in (("id", C+1),("body","not official")):
            v = fixture(); v[2][k] = val
            self.assertEqual(self.verdict(v)["decision"], "BLOCKED")
        v = fixture(); v[2]["performed_via_github_app"] = {"slug": "other"}
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_task_requires_exact_opt_in_and_read_only(self):
        for key,val in (("auto_roy_review_after_ci",False),
                        ("release_gate","AUTO_MERGE"),("mode","PR_BRANCH_EDIT_APPROVED"),
                        ("required_reviewers",[])):
            v = fixture(); v[4][key] = val
            self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_duplicate_issue_rejected(self):
        self.assertEqual(
            decide_ci_bot_candidate(*fixture(),known_issue_ids={999})["decision"],
            "DUPLICATE"
        )

    def test_duplicate_field_rejected(self):
        v = fixture(); v[0]["issue"]["body"] += "CI-Run: 999\n"
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_missing_evidence_is_fail_closed(self):
        v = fixture(); v[3] = None
        self.assertEqual(self.verdict(v)["decision"], "BLOCKED")

    def test_no_source_can_authorize_deployment(self):
        v = fixture(); v[0]["issue"]["body"] += "\nMerge-Allowed: true"
        self.assertFalse(self.verdict(v)["merge_allowed"])


if __name__ == "__main__":
    unittest.main()
