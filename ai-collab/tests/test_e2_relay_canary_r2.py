"""Test-only RED canary, expected to go green from one Work source edit."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from e2_relay_canary_r2 import relay_approval_label

class E2WorkRetryCanaryTests(unittest.TestCase):
    def test_literal_true(self):
        self.assertEqual(relay_approval_label(True), "APPROVED")
    def test_literal_false(self):
        self.assertEqual(relay_approval_label(False), "BLOCKED")
    def test_string_no(self):
        self.assertEqual(relay_approval_label("no"), "BLOCKED")
    def test_integer_one(self):
        self.assertEqual(relay_approval_label(1), "BLOCKED")
    def test_none(self):
        self.assertEqual(relay_approval_label(None), "BLOCKED")

if __name__ == "__main__":
    unittest.main()
