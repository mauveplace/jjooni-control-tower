"""Guard official BLS release identities without assuming a generic prior month."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from official_bls_api import verified_schedule_month, collect_api


class VerifiedBlsScheduleTests(unittest.TestCase):
    def event(self, title, day, period=None):
        return {'title': title, 'datetime_kst': f'2026-10-{day}T21:30:00+09:00',
                'reference_period': period}

    def test_only_exact_official_release_dates(self):
        cases = [('Consumer Price Index', '14', 'cpi'),
                 ('Producer Price Index', '15', 'ppi'),
                 ('U.S. Import and Export Price Indexes', '16', 'ximpim')]
        for title, day, code in cases:
            with self.subTest(code=code):
                self.assertEqual(verified_schedule_month(self.event(title, day), code), (2026, 9))
                self.assertIsNone(verified_schedule_month(self.event(title, '20'), code))
                self.assertIsNone(verified_schedule_month(self.event('Other release', day), code))

    def test_unverified_month_never_calls_api(self):
        checks = []
        with patch('official_bls_api.fetch_series') as fetch:
            self.assertIsNone(collect_api(self.event('Consumer Price Index', '20'), 'cpi', checks))
            fetch.assert_not_called()
        self.assertEqual(checks[-1]['result'], 'REFERENCE_PERIOD_MISSING')

    def test_conflicting_explicit_reference_period_fails_closed(self):
        checks = []
        with patch('official_bls_api.fetch_series') as fetch:
            self.assertIsNone(collect_api(self.event('Consumer Price Index', '14', 'unverified'), 'cpi', checks))
            fetch.assert_not_called()
        self.assertEqual(checks[-1]['result'], 'REFERENCE_PERIOD_MISSING')

    def test_api_results_are_revision_labelled_and_schedule_cited(self):
        checks = []
        values = {(2026, 9): Decimal('110'), (2025, 9): Decimal('100'),
                  (2026, 8): Decimal('109')}
        with patch('official_bls_api.fetch_series', return_value=(values, 'https://api.bls.gov/test')):
            rows, _ = collect_api(self.event('Consumer Price Index', '14'), 'cpi', checks)
        self.assertTrue(rows)
        self.assertTrue(all(row['value_vintage'] == 'LATEST_REVISION' for row in rows))
        self.assertTrue(all(row['reference_period'] == '2026-09' for row in rows))
        self.assertEqual(checks[0]['result'], 'REFERENCE_PERIOD_VERIFIED_FROM_OFFICIAL_SCHEDULE')
        self.assertIn('/schedule/2026/10_sched_list.htm', checks[0]['url'])


if __name__ == '__main__':
    unittest.main()
