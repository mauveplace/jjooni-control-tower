"""Ensure quote collection does not run in the US rates or market heartbeat."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/observatory-us-rates-intraday.yml'


class ExistingRatesCryptoHeartbeatTests(unittest.TestCase):
    def test_no_new_schedule_or_runner_is_added(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        crons = re.findall(r"^\s*- cron: '([^']+)'$", text, re.M)
        self.assertEqual(crons, ['45 12-22 * * 1-5'])
        self.assertEqual(len(re.findall(r'^  collect:$', text, re.M)), 1)

    def test_market_and_rates_jobs_do_not_schedule_spot_quotes(self):
        for workflow in (WORKFLOW, WORKFLOW.with_name('market-observatory-daily.yml')):
            self.assertNotIn('refresh_observatory_crypto.py', workflow.read_text(encoding='utf-8'))
