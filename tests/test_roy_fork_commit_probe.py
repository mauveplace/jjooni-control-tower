"""Static guardrails for ROY fork commit/PR manual credential probe."""
from pathlib import Path
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/roy-fork-commit-pr-probe.yml"

class ProbeContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = WORKFLOW.read_text(encoding="utf-8")
        cls.events = cls.src.split("\non:\n", 1)[1].split("\npermissions:\n", 1)[0]

    def test_only_manual(self):
        self.assertIn("  workflow_dispatch:", self.events)
        for event in ("pull_request:", "pull_request_target:", "push:", "schedule:", "workflow_run:", "issue_comment:"):
            self.assertNotIn("  " + event, self.events)

    def test_token_isolated(self):
        self.assertIn("ROY_FORK_TOKEN: ${{ secrets.ROY_FORK_TOKEN }}", self.src)
        self.assertIn("  contents: read", self.src)
        self.assertNotIn("actions/checkout@", self.src)
        self.assertIn("GITHUB_ACTOR", self.src)
        self.assertIn("GITHUB_REF", self.src)

    def test_fixed_safe_targets(self):
        self.assertIn("roy/auth-probe-20261109", self.src)
        self.assertIn("ai-collab/roy-probes/20261109-fork-commit-proof.md", self.src)
        self.assertNotIn("tools/publish_observatory_data.py", self.src)
        self.assertNotIn("market-observatory/data/", self.src)

    def test_no_user_impersonation(self):
        self.assertIn("354357400", self.src)
        self.assertIn("no owner-token fallback", self.src)
        self.assertIn("ROY_UPSTREAM_PR=BLOCKED", self.src)

if __name__ == "__main__":
    unittest.main()
