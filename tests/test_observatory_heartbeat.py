import pathlib
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import observatory_heartbeat_decision as hb  # noqa: E402

NOW = datetime(2026, 11, 8, 7, 0, tzinfo=timezone.utc)


def obs(quote_age_min):
    stamp = (NOW - timedelta(minutes=quote_age_min)).astimezone(timezone(timedelta(hours=9))).isoformat()
    return {'crypto_market': {s: {'status': 'LIVE', 'quote_as_of_kst': stamp} for s in ('BTCUSD', 'ETHUSD')}}


class HeartbeatDecisionTest(unittest.TestCase):
    def run_decide(self, data):
        files = {'observatory.json': data}
        with mock.patch.object(hb, 'load', side_effect=lambda p: files.get(pathlib.Path(p).name, {})), \
             mock.patch.object(hb, 'refresh_decision', return_value={'should_refresh': False, 'age_min': 10}), \
             mock.patch.object(hb.sector_heartbeat_gate, 'should_refresh', return_value=False):
            return hb.decide(NOW)

    def test_stale_quote_requests_crypto_refresh(self):
        d = self.run_decide(obs(77))
        self.assertEqual((d['crypto'], d['alert']), ('refresh', 'crypto'))

    def test_due_but_not_yet_stale_does_not_alert(self):
        d = self.run_decide(obs(50))
        self.assertEqual((d['crypto'], d['alert']), ('refresh', 'none'))

    def test_market_behind_session_alerts_after_90_min(self):
        files = {'observatory.json': obs(10)}
        with mock.patch.object(hb, 'load', side_effect=lambda p: files.get(pathlib.Path(p).name, {})), \
             mock.patch.object(hb, 'refresh_decision', return_value={'should_refresh': True, 'healthy': False, 'age_min': 95}), \
             mock.patch.object(hb.sector_heartbeat_gate, 'should_refresh', return_value=False):
            self.assertEqual(hb.decide(NOW)['alert'], 'market')

    def test_fresh_quote_requests_nothing(self):
        d = self.run_decide(obs(10))
        self.assertEqual((d['crypto'], d['market'], d['alert']), ('ok', 'ok', 'none'))


class HeartbeatWorkflowContractTest(unittest.TestCase):
    def test_manual_diagnostic_has_no_background_runner_or_writer(self):
        text = (ROOT / '.github/workflows/observatory-heartbeat.yml').read_text()
        wf = yaml.safe_load(text)
        self.assertEqual(wf['permissions'], {'contents': 'read'})
        self.assertIn('diagnose', wf['jobs'])
        self.assertNotIn('schedule:', text)
        self.assertIn('cancel-in-progress: true', text)
        self.assertIn('    paths:\n      - .github/workflows/observatory-heartbeat.yml', text)
        self.assertNotIn('gh workflow run', text)
        self.assertNotIn('sleep "$INTERVAL_SECONDS"', text)
        self.assertNotIn('Hand over to the next relay run', text)
        self.assertIn('python tools/observatory_heartbeat_decision.py',
                      wf['jobs']['diagnose']['steps'][-1]['run'])


    def test_heartbeat_dispatch_runs_only_hourly_gate(self):
        text = (ROOT / '.github/workflows/market-observatory-daily.yml').read_text()
        wf = yaml.safe_load(text)
        self.assertIn("inputs.heartbeat", wf['jobs']['hourly_gate']['if'])
        self.assertIn("!(github.event_name == 'workflow_dispatch' && inputs.heartbeat)", wf['jobs']['build']['if'])


if __name__ == '__main__':
    unittest.main()
