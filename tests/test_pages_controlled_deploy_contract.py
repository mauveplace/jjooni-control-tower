"""Regression contract for Pages deployment reliability and safe publication scope."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/pages-controlled-deploy.yml"
DAILY = ROOT / ".github/workflows/market-observatory-daily.yml"


class PagesControlledDeployContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = WORKFLOW.read_text(encoding="utf-8")
        cls.daily = DAILY.read_text(encoding="utf-8")

    def test_noop_deployment_requires_observed_success_for_exact_source(self):
        src = self.src
        self.assertIn('ref: ${{ needs.plan.outputs.target_sha }}', src)
        self.assertIn('deployment_sha" == "$sha"', src)
        self.assertIn('"$status" == \'success\'', src)
        self.assertIn('should_deploy=$should', src)
        self.assertIn('if: ${{ needs.plan.outputs.should_deploy == \'true\' }}', src)

    def test_api_uncertainty_retries_instead_of_suppressing_deploy(self):
        src = self.src
        self.assertIn('should=true', src)
        self.assertIn("metadata unavailable; retry publishing", src)
        self.assertIn("status unavailable; retry publishing", src)
        self.assertIn('PAGES_DEPLOY_PLAN=RETRY', src)

    def test_staging_preserves_public_market_data_and_excludes_source_code(self):
        src = self.src
        for filename in ("market-observatory/data/observatory.json",
                         "market-observatory/data/economic-calendar-history.json",
                         "public-market-daily.json", "index.html"):
            self.assertIn(filename, src)
        for directory in (".github", "tools", "tests", "ai-collab", "ai-collab-dispatch"):
            self.assertIn("exclude='/" + directory + "/'", src)
        self.assertIn("PAGES_SITE_STAGE=PASS", src)

    def test_no_automatic_traffic_shift_before_owner_configuration(self):
        src = self.src
        self.assertIn("vars.PAGES_ACTIONS_ENABLED == 'true'", src)
        self.assertIn("cron: '*/15 * * * *'", src)
        self.assertIn("cancel-in-progress: false", src)
        self.assertIn('pages: write', src)
        self.assertIn('deployments: read', src)

    def test_pages_deployments_do_not_trigger_canonical_refresh(self):
        self.assertNotIn('      - "pages build and deployment"', self.daily)


if __name__ == "__main__":
    unittest.main()
