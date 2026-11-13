"""E2 Work canary — literal boolean approval is the only success condition."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from e2_relay_canary import relay_approval_label


class RelayApprovalCanaryTests(unittest.TestCase):
    def test_literal_true_is_approved(self):
        self.assertEqual(relay_approval_label(True), "APPROVED")

    def test_false_is_blocked(self):
        self.assertEqual(relay_approval_label(False), "BLOCKED")

    def test_string_no_must_be_blocked(self):
        self.assertEqual(relay_approval_label("no"), "BLOCKED")

    def test_integer_one_must_be_blocked(self):
        self.assertEqual(relay_approval_label(1), "BLOCKED")

    def test_missing_value_is_blocked(self):
        self.assertEqual(relay_approval_label(None), "BLOCKED")


if __name__ == "__main__":
    unittest.main()
