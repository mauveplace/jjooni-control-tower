"""Guard best-effort crypto reuse of an existing, already-billed schedule."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/observatory-us-rates-intraday.yml'


class ExistingRatesCryptoHeartbeatTests(unittest.TestCase):
    def test_no_new_schedule_or_runner_is_added(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        crons = re.findall(r"^\s*- cron: '([^']+)'$", text, re.M)
        self.assertEqual(crons, ['17,47 * * * 1-5'])
        self.assertEqual(len(re.findall(r'^  collect:$', text, re.M)), 1)

    def test_crypto_failure_is_isolated_and_never_published(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        start = text.index('      - name: Best-effort BTC ETH quote refresh on existing rates heartbeat')
        end = text.index('      - name: Expose partial source failures', start)
        block = text[start:end]
        self.assertIn("if: github.event_name == 'schedule'", block)
        self.assertIn('id: crypto', block)
        self.assertIn('continue-on-error: true', block)
        self.assertIn('run: python tools/refresh_observatory_crypto.py', block)
        self.assertIn("steps.crypto.outcome == 'success'", block)
        self.assertIn('market-observatory/data/observatory.json', block)


if __name__ == '__main__':
    unittest.main()
