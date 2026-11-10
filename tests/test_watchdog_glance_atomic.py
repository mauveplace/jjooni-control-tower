"""Regression: close-watchdog atomically publishes derived glance after GitHub-token source writes."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WatchdogGlancePublicationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = (ROOT / ".github/workflows/market-observatory-close-watchdog.yml").read_text(encoding="utf-8")
        cls.publisher = (ROOT / "tools/publish_observatory_data.py").read_text(encoding="utf-8")

    def test_close_repair_publishes_glance_with_canonical_bundle(self):
        section = self.workflow.split("- id: publish_repair", 1)[1].split("- id: verify_repair", 1)[0]
        for path in (
            "market-observatory/data/observatory.json",
            "market-observatory/data/daily-market-pulse.json",
            "market-observatory/data/daily-glance.json",
            "public-market-daily.json",
        ):
            self.assertIn(path, section)
        self.assertIn("if DATA+'daily-glance.json' in paths:", self.publisher)
        self.assertIn("build_daily_glance.main()", self.publisher)

    def test_verify_main_has_same_session_and_exact_source_vintage(self):
        verification = self.workflow.split("- id: verify_repair", 1)[1].split("- id: publish_glance", 1)[0]
        self.assertIn("g.get('us_session')==o.get('us_completed_session_date')", verification)
        self.assertIn("g.get('source_generated_kst')==o.get('generated_kst')", verification)

    def test_healthy_but_stale_glance_republished_without_full_rebuild(self):
        self.assertIn("should_refresh_glance=eligible and healthy and not glance_fresh", self.workflow)
        self.assertIn("glance.get('source_generated_kst')==obs.get('generated_kst')", self.workflow)
        rebuild = self.workflow.split("- id: rebuild", 1)[1].split("- id: recovery_acceptance", 1)[0]
        self.assertIn("steps.gate.outputs.should_repair == 'true'", rebuild)
        repair_only = self.workflow.split("- id: publish_glance", 1)[1].split("- name: Healthy no-op", 1)[0]
        self.assertIn("steps.gate.outputs.should_refresh_glance == 'true'", repair_only)
        self.assertIn("market-observatory/data/daily-glance.json", repair_only)
        self.assertNotIn("build_market_observatory.py", repair_only)
        self.assertIn("GLANCE_SOURCE_VINTAGE_STALE", repair_only)

    def test_no_new_unnecessary_polling_or_trading_path(self):
        self.assertIn("group: economic-calendar-canonical-writer", self.workflow)
        self.assertIn("cancel-in-progress: false", self.workflow)
        self.assertIn("market-observatory/data/morning-brief/latest.json", self.workflow)
        self.assertNotIn("*/5 * * * *", self.workflow)
        self.assertNotIn("place_order", self.workflow)


if __name__ == "__main__":
    unittest.main()
