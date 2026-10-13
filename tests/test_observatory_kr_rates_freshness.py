from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location('refresh_kr_rates', TOOLS / 'refresh_observatory_kr_rates.py')
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MOD)


def row(day: str, value: str, item: str) -> dict:
    return {
        'STAT_CODE': '817Y002',
        'ITEM_CODE1': item,
        'TIME': day,
        'DATA_VALUE': value,
    }


class KrRatesFreshnessTest(unittest.TestCase):
    def test_page_size_respects_ecos_sample_limit(self):
        self.assertEqual(MOD._page_size('sample'), 10)
        self.assertEqual(MOD._page_size('SAMPLE'), 10)
        self.assertEqual(MOD._page_size('registered-key'), 1000)

    def test_registered_fetch_reads_tail_when_total_exceeds_1000(self):
        item = '010200000'
        first = {
            'StatisticSearch': {
                'list_total_count': 1501,
                'row': [row('20251218', '2.95', item)],
            }
        }
        tail = {
            'StatisticSearch': {
                'list_total_count': 1501,
                'row': [
                    row('20261008', '3.983', item),
                    row('20261012', '4.011', item),
                ],
            }
        }
        with patch.object(MOD, '_get_json', side_effect=[first, tail]) as fetch:
            got = MOD.fetch_ecos_series('registered-key', item, '20250501', '20261013')
        self.assertEqual(fetch.call_count, 2)
        self.assertIn('/1/1000/817Y002/', fetch.call_args_list[0].args[0])
        self.assertIn('/502/1501/817Y002/', fetch.call_args_list[1].args[0])
        self.assertEqual(got[-1], {'date': '2026-10-12', 'value': 4.011})

    def test_sample_fetch_uses_10_row_head_then_latest_10_row_tail(self):
        item = '010200000'
        first = {
            'StatisticSearch': {
                'list_total_count': 245,
                'row': [row('20250501', '2.90', item)],
            }
        }
        tail = {
            'StatisticSearch': {
                'list_total_count': 245,
                'row': [
                    row('20261008', '3.983', item),
                    row('20261012', '4.011', item),
                ],
            }
        }
        with patch.object(MOD, '_get_json', side_effect=[first, tail]) as fetch:
            got = MOD.fetch_ecos_series('sample', item, '20250501', '20261013')
        self.assertEqual(fetch.call_count, 2)
        first_url = fetch.call_args_list[0].args[0]
        tail_url = fetch.call_args_list[1].args[0]
        self.assertIn('/sample/json/kr/1/10/817Y002/', first_url)
        self.assertIn('/sample/json/kr/236/245/817Y002/', tail_url)
        self.assertEqual(got[-1], {'date': '2026-10-12', 'value': 4.011})

    def test_extract_filters_wrong_item_identity(self):
        obj = {'StatisticSearch': {'list_total_count': 2, 'row': [
            row('20261012', '4.011', '010200000'),
            row('20261012', '9.999', '010210000'),
        ]}}
        got, total = MOD._extract_rows(obj, '010200000')
        self.assertEqual(total, 2)
        self.assertEqual(got, [{'date': '2026-10-12', 'value': 4.011}])

    def test_spread_uses_only_same_date_observations(self):
        data = {
            'series': {
                'KR3Y': [{'date': '2026-10-10', 'value': 3.0}],
                'KR10Y': [{'date': '2026-10-10', 'value': 3.4}],
            },
            'latest': {},
        }
        values = {
            'KR3Y': [{'date': '2026-10-12', 'value': 4.0}],
            'KR5Y': [{'date': '2026-10-12', 'value': 4.1}],
            'KR10Y': [{'date': '2026-10-12', 'value': 4.4}],
            'KR20Y': [{'date': '2026-10-12', 'value': 4.6}],
            'KR30Y': [{'date': '2026-10-12', 'value': 4.7}],
        }
        def fake_fetch(_key, item, _start, _end):
            name = next(k for k, v in MOD.KR_RATES.items() if v == item)
            return values[name]
        with patch.object(MOD, 'fetch_ecos_series', side_effect=fake_fetch), patch.object(MOD, '_age_days', return_value=1):
            out = MOD.refresh(data, api_key='registered-key')
        self.assertEqual(out['series']['KR_3S10S'][-1], {'date': '2026-10-12', 'value': 0.4})
        q = out['cross_market_freshness_quality']['KR_RATES']
        self.assertEqual(q['status'], 'LIVE')
        self.assertTrue(q['fetch_succeeded'])
        self.assertEqual(q['failed_series'], {})
        self.assertEqual(q['api_mode'], 'registered')

    def test_fetch_failure_preserves_prior_and_never_invents_rate(self):
        data = {
            'series': {
                'KR3Y': [{'date': '2025-12-18', 'value': 2.95}],
                'KR5Y': [{'date': '2026-10-12', 'value': 4.1}],
                'KR10Y': [{'date': '2026-10-12', 'value': 4.4}],
                'KR20Y': [{'date': '2026-10-12', 'value': 4.6}],
                'KR30Y': [{'date': '2026-10-12', 'value': 4.7}],
            },
            'latest': {'KR3Y': 2.95},
        }
        def fake_fetch(_key, item, _start, _end):
            if item == MOD.KR_RATES['KR3Y']:
                raise RuntimeError('source unavailable')
            return [{'date': '2026-10-12', 'value': 4.0}]
        with patch.object(MOD, 'fetch_ecos_series', side_effect=fake_fetch):
            out = MOD.refresh(data, api_key='sample')
        self.assertEqual(out['latest']['KR3Y'], 2.95)
        self.assertEqual(out['series']['KR3Y'][-1]['date'], '2025-12-18')
        self.assertEqual(out['cross_market_freshness_quality']['KR3Y']['status'], 'STALE')
        q = out['cross_market_freshness_quality']['KR_RATES']
        self.assertEqual(q['status'], 'LAGGING')
        self.assertFalse(q['fetch_succeeded'])
        self.assertIn('KR3Y', q['failed_series'])
        self.assertEqual(q['api_mode'], 'sample')


if __name__ == '__main__':
    unittest.main()
