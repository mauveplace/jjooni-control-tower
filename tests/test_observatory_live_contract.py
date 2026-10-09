#!/usr/bin/env python3
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import postprocess_market_observatory as obs_post  # noqa: E402


class ObservatoryLiveContractTest(unittest.TestCase):
    def test_fear_greed_history_promotes_to_observatory_series(self):
        obs = {'us_completed_session_date': '2026-10-08'}
        pulse = {
            'market_date_us': '2026-10-08',
            'history': [
                {'market_date_us': '2026-10-07', 'fear_greed': 47.0},
                {'market_date_us': '2026-10-08', 'fear_greed': 44.5},
            ],
        }
        public = {
            'market_context': {
                'items': {
                    'FEAR_GREED': {'value': 44.5, 'source': 'CNN_FEAR_GREED_PUBLIC'}
                }
            }
        }
        current = {'value': 38.1142857142857, 'source': 'CNN_FEAR_GREED_PUBLIC'}

        rows = obs_post.build_fear_greed_series(obs, public, pulse, current)

        self.assertEqual([r['date'] for r in rows], ['2026-10-07', '2026-10-08'])
        self.assertAlmostEqual(rows[-1]['value'], 38.114286, places=6)

    def test_today_strategy_is_read_only_and_preserves_tripod_authority(self):
        obs = {
            'us_completed_session_date': '2026-10-08',
            'latest': {'FEAR_GREED': 38.1},
            'tripod_latest': {
                'date': '2026-10-08',
                'regime': '상승',
                'target': 'TQQQ 100%',
                'action': 'HOLD_NO_TRADE',
                'signal_changed': False,
                'target_changed': False,
                'vix10': 15.604,
                'drawdown_52w_pct': -1.597,
            },
        }
        pulse = {
            'market_date_us': '2026-10-08',
            'derived': {'risk': 'RISK_OFF'},
        }

        strategy = obs_post.build_today_strategy(obs, pulse)

        self.assertEqual(strategy['action_code'], 'HOLD_RISK_ON')
        self.assertEqual(strategy['target'], 'TQQQ 100%')
        self.assertTrue(strategy['pulse_aligned'])
        self.assertTrue(strategy['read_only'])
        self.assertFalse(strategy['autobot_direct_trade_trigger'])
        self.assertTrue(any('RISK_OFF' in x for x in strategy['risk_flags']))

    def test_unaligned_market_pulse_cannot_override_tripod(self):
        obs = {
            'us_completed_session_date': '2026-10-08',
            'latest': {'FEAR_GREED': 80},
            'tripod_latest': {
                'regime': '하락',
                'target': '현금 100%',
                'signal_changed': False,
                'vix10': 20.0,
                'drawdown_52w_pct': -12.0,
            },
        }
        pulse = {
            'market_date_us': '2026-10-07',
            'derived': {'risk': 'RISK_ON'},
        }

        strategy = obs_post.build_today_strategy(obs, pulse)

        self.assertEqual(strategy['action_code'], 'HOLD_DEFENSIVE')
        self.assertFalse(strategy['pulse_aligned'])
        self.assertIsNone(strategy['guardrails']['market_pulse_risk'])
        self.assertTrue(any('극단적 탐욕' in x for x in strategy['risk_flags']))

    def test_main_wires_live_contract_patches(self):
        import inspect

        source = inspect.getsource(obs_post.main)
        self.assertIn('patch_fear_greed(o)', source)
        self.assertIn('patch_today_strategy(o)', source)
        self.assertIn('patch_freshness(o)', source)


if __name__ == '__main__':
    unittest.main()
