import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mobile_review_loop import decide_review


class MobileReviewLoopTests(unittest.TestCase):
    def decide(self, **kwargs):
        return decide_review(work_type="backend", **kwargs)

    def test_simple_bug_does_not_call_roy(self):
        r = self.decide()
        self.assertEqual(r["decision"], "JJOONI_TESTS_ONLY")
        self.assertFalse(r["review_recommended"])

    def test_substantive_change_requests_one_review(self):
        r = self.decide(complexity="SUBSTANTIVE")
        self.assertEqual(r["decision"], "REQUEST_ROY")
        self.assertEqual(r["reviews_remaining_before_escalation"], 2)

    def test_repeated_incident_requests_review(self):
        self.assertEqual(self.decide(repeated_failure=True)["decision"], "REQUEST_ROY")

    def test_high_assurance_cannot_skip_review(self):
        for kind in ("data_integrity", "security_review", "strategy_analysis"):
            with self.subTest(kind=kind):
                r = decide_review(work_type=kind)
                self.assertTrue(r["review_required_by_policy"])
                self.assertEqual(r["decision"], "REQUEST_ROY")

    def test_owner_can_request_review_of_small_change(self):
        r = self.decide(owner_requests_review=True)
        self.assertEqual(r["decision"], "REQUEST_ROY")
        self.assertTrue(r["review_required_by_policy"])

    def test_needs_changes_does_not_rerun_old_head(self):
        r = self.decide(complexity="SUBSTANTIVE", reviews_completed=1,
                        latest_verdict="NEEDS_CHANGES", provenance_verified=True)
        self.assertEqual(r["decision"], "JJOONI_FIX_FIRST")

    def test_changed_head_may_request_second_review(self):
        r = self.decide(complexity="SUBSTANTIVE", reviews_completed=1,
                        latest_verdict="NEEDS_CHANGES", reviewed_head_changed=True,
                        provenance_verified=True)
        self.assertEqual(r["decision"], "REQUEST_ROY")
        self.assertEqual(r["reviews_remaining_before_escalation"], 1)

    def test_second_failure_escalates_not_approves(self):
        r = self.decide(reviews_completed=2, latest_verdict="NEEDS_CHANGES",
                        reviewed_head_changed=True, provenance_verified=True)
        self.assertEqual(r["decision"], "ESCALATE_TO_OWNER")
        self.assertFalse(r["safe_to_merge"])

    def test_blockers_override_pass(self):
        r = self.decide(reviews_completed=1, latest_verdict="PASS",
                        provenance_verified=True, critical_findings_open=True)
        self.assertEqual(r["decision"], "BLOCKED_REQUIRES_FIX")

    def test_unverified_pass_is_not_ready(self):
        r = self.decide(reviews_completed=1, latest_verdict="PASS")
        self.assertEqual(r["decision"], "VERIFY_ROY_SOURCE")

    def test_verified_pass_still_requires_human_release_gate(self):
        r = self.decide(reviews_completed=1, latest_verdict="PASS",
                        provenance_verified=True)
        self.assertEqual(r["decision"], "READY_FOR_OWNER_GATE")
        for key in ("safe_to_merge", "safe_to_deploy", "safe_to_trade"):
            self.assertFalse(r[key])

    def test_material_change_after_pass_needs_new_review(self):
        r = self.decide(reviews_completed=1, latest_verdict="PASS",
                        provenance_verified=True, reviewed_head_changed=True)
        self.assertEqual(r["decision"], "REQUEST_ROY")

    def test_over_budget_change_escalates(self):
        r = self.decide(reviews_completed=2, latest_verdict="PASS",
                        provenance_verified=True, reviewed_head_changed=True)
        self.assertEqual(r["decision"], "ESCALATE_TO_OWNER")

    def test_fixed_blocked_head_reenters_review(self):
        r = self.decide(reviews_completed=1, latest_verdict="BLOCKED",
                        reviewed_head_changed=True, provenance_verified=True)
        self.assertEqual(r["decision"], "REQUEST_ROY")
        self.assertFalse(r["safe_to_merge"])

    def test_unchanged_blocked_stays_blocked(self):
        r = self.decide(reviews_completed=1, latest_verdict="BLOCKED",
                        provenance_verified=True)
        self.assertEqual(r["decision"], "BLOCKED_REQUIRES_FIX")

    def test_second_blocked_review_escalates(self):
        r = self.decide(reviews_completed=2, latest_verdict="BLOCKED",
                        reviewed_head_changed=True, provenance_verified=True)
        self.assertEqual(r["decision"], "ESCALATE_TO_OWNER")

    def test_second_needs_changes_escalates_immediately(self):
        r = self.decide(reviews_completed=2, latest_verdict="NEEDS_CHANGES",
                        provenance_verified=True)
        self.assertEqual(r["decision"], "ESCALATE_TO_OWNER")

    def test_unverified_negative_review_cannot_drive_next_round(self):
        for verdict in ("NEEDS_CHANGES", "BLOCKED"):
            with self.subTest(verdict=verdict):
                r = self.decide(reviews_completed=1, latest_verdict=verdict,
                                reviewed_head_changed=True)
                self.assertEqual(r["decision"], "VERIFY_ROY_SOURCE")
                self.assertFalse(r["safe_to_merge"])

    def test_critical_finding_stays_blocked_even_without_provenance(self):
        r = self.decide(reviews_completed=1, latest_verdict="PASS",
                        critical_findings_open=True)
        self.assertEqual(r["decision"], "BLOCKED_REQUIRES_FIX")

    def test_rejected_unsafe_inputs(self):
        invalid = (
            {"reviews_completed": -1}, {"reviews_completed": 3},
            {"reviews_completed": 1, "latest_verdict": "NONE"},
            {"reviews_completed": 0, "latest_verdict": "PASS"},
            {"reviews_completed": True},
            {"latest_verdict": "FAKE_PASS"},
            {"provenance_verified": "yes"},
            {"reviewed_head_changed": 1},
            {"complexity": "IMPOSSIBLE"},
        )
        for x in invalid:
            with self.subTest(case=x), self.assertRaises(ValueError):
                self.decide(**x)


if __name__ == "__main__":
    unittest.main()
