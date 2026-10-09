#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import build_observatory_freshness as freshness  # noqa: E402


class ObservatoryFreshnessStatusTest(unittest.TestCase):
    def write(self, root: Path, rel: str, obj: dict):
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj), encoding='utf-8')

    def test_aligned_live_inputs_are_live(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.write(root, 'market-observatory/data/observatory.json', {
                'generated_kst': '2026-10-09T06:10:00+09:00',
                'us_completed_session_date': '2026-10-08',
                'freshness': {'status': 'LIVE'},
                'latest': {'FEAR_GREED': 38.1, 'FEAR_GREED_RATING': 'FEAR'},
                'quality': {'fear_greed': {'state': 'LIVE', 'source': 'CNN', 'observed_at': '2026-10-08'}},
                'tripod_latest': {'date': '2026-10-08', 'regime': '상승', 'target': 'TQQQ 100%'},
            })
            self.write(root, 'market-observatory/data/daily-market-pulse.json', {
                'generated_kst': '2026-10-09T06:11:00+09:00',
                'market_date_us': '2026-10-08',
                'snapshot_status': 'FINAL',
            })
            self.write(root, 'public-market-daily.json', {
                'generated_kst': '2026-10-09T06:12:00+09:00',
                'tripod_signal': {'ok': True, 'date': '2026-10-08'},
            })
            self.write(root, 'market-observatory/data/fed-watch.json', {
                'freshness': 'LIVE', 'market_data_as_of': '2026-10-08', 'meeting_date': '2026-10-28'
            })
            self.write(root, 'market-observatory/data/economic-calendar.json', {
                'generated_kst': '2026-10-09T06:12:00+09:00', 'events': [], 'actual_freshness': {'status': 'LIVE'}
            })
            self.write(root, 'market-observatory/data/sector-etf.json', {'as_of_date': '2026-10-08'})

            out = freshness.build_status(root)

            self.assertEqual(out['overall'], 'LIVE')
            self.assertTrue(out['session_alignment']['aligned'])
            self.assertTrue(out['session_alignment']['pulse_aligned'])
            self.assertTrue(out['session_alignment']['tripod_aligned'])
            self.assertEqual(out['groups']['pulse']['state'], 'LIVE')
            self.assertEqual(out['groups']['tripod']['state'], 'LIVE')
            self.assertFalse(out['watchdog_required'])

    def test_pulse_misalignment_is_critical_without_blaming_tripod(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.write(root, 'market-observatory/data/observatory.json', {
                'generated_kst': '2026-10-09T06:10:00+09:00',
                'us_completed_session_date': '2026-10-08',
                'freshness': {'status': 'LIVE'},
                'latest': {'FEAR_GREED': 38.1},
                'tripod_latest': {'date': '2026-10-08'},
            })
            self.write(root, 'market-observatory/data/daily-market-pulse.json', {
                'market_date_us': '2026-10-07', 'snapshot_status': 'FINAL'
            })
            self.write(root, 'public-market-daily.json', {'tripod_signal': {'ok': True, 'date': '2026-10-08'}})

            out = freshness.build_status(root)

            self.assertEqual(out['overall'], 'DEGRADED')
            self.assertEqual(out['groups']['pulse']['state'], 'MISALIGNED')
            self.assertEqual(out['groups']['tripod']['state'], 'LIVE')
            self.assertIn('pulse', out['critical_bad'])
            self.assertNotIn('tripod', out['critical_bad'])
            self.assertFalse(out['session_alignment']['pulse_aligned'])
            self.assertTrue(out['session_alignment']['tripod_aligned'])

    def test_tripod_misalignment_is_critical(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.write(root, 'market-observatory/data/observatory.json', {
                'generated_kst': '2026-10-09T06:10:00+09:00',
                'us_completed_session_date': '2026-10-08',
                'freshness': {'status': 'LIVE'},
                'latest': {'FEAR_GREED': 38.1},
                'tripod_latest': {'date': '2026-10-08'},
            })
            self.write(root, 'market-observatory/data/daily-market-pulse.json', {
                'market_date_us': '2026-10-08', 'snapshot_status': 'FINAL'
            })
            self.write(root, 'public-market-daily.json', {'tripod_signal': {'ok': True, 'date': '2026-10-07'}})

            out = freshness.build_status(root)

            self.assertEqual(out['overall'], 'DEGRADED')
            self.assertFalse(out['session_alignment']['aligned'])
            self.assertTrue(out['session_alignment']['pulse_aligned'])
            self.assertFalse(out['session_alignment']['tripod_aligned'])
            self.assertEqual(out['groups']['pulse']['state'], 'LIVE')
            self.assertEqual(out['groups']['tripod']['state'], 'MISALIGNED')
            self.assertTrue(out['watchdog_required'])

    def test_fedwatch_lagging_is_warning_not_hard_failure(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.write(root, 'market-observatory/data/observatory.json', {
                'generated_kst': '2026-10-09T06:10:00+09:00',
                'us_completed_session_date': '2026-10-08',
                'freshness': {'status': 'LIVE'},
                'latest': {'FEAR_GREED': 38.1},
                'tripod_latest': {'date': '2026-10-08'},
            })
            self.write(root, 'market-observatory/data/daily-market-pulse.json', {
                'market_date_us': '2026-10-08', 'snapshot_status': 'FINAL'
            })
            self.write(root, 'public-market-daily.json', {'tripod_signal': {'ok': True, 'date': '2026-10-08'}})
            self.write(root, 'market-observatory/data/fed-watch.json', {'freshness': 'LAGGING', 'market_data_as_of': '2026-10-07'})

            out = freshness.build_status(root)

            self.assertEqual(out['overall'], 'LIVE_WITH_WARNINGS')
            self.assertIn('fedwatch', out['warnings'])
            self.assertFalse(out['watchdog_required'])


if __name__ == '__main__':
    unittest.main()
