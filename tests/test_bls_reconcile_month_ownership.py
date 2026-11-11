import pathlib
import sys
import unittest
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import reconcile_bls_official_history as rec  # noqa: E402

NOW = datetime(2026, 11, 11, 14, 0, tzinfo=ZoneInfo('Asia/Seoul'))
D = Decimal


def idx(points):
    return {k: D(v) for k, v in points.items()}


# Shaped like 2026 BLS CPI: October 2025 was never collected, so October 2026
# YoY cannot be computed; August 2026 MoM equals October 2026 MoM (0.4% / 0.3%).
FAKE = {
    'CUUR0000SA0': idx({(2026, 10): '103.4', (2026, 9): '103.0', (2026, 8): '102.4', (2025, 8): '99.0', (2025, 9): '99.3'}),
    'CUSR0000SA0': idx({(2026, 10): '100.4', (2026, 9): '100.0', (2026, 8): '99.4', (2026, 7): '99.0'}),
    'CUUR0000SA0L1E': idx({(2026, 10): '102.6', (2026, 9): '102.4', (2026, 8): '102.4', (2025, 8): '100.0', (2025, 9): '99.8'}),
    'CUSR0000SA0L1E': idx({(2026, 10): '100.3', (2026, 9): '100.0', (2026, 8): '99.7', (2026, 7): '99.4'}),
}


def fetch(series, year):
    return FAKE[series], 'https://api.bls.gov/' + series


def cpi(day, **metrics):
    return {'title': 'Consumer Price Index', 'country': 'US', 'actual_status': 'RELEASED',
            'datetime_kst': day + 'T22:30+09:00',
            'market_metrics': [{'key': k, 'actual': v, 'source': 'FairEconomy/ForexFactory'} for k, v in metrics.items()]}


class MonthOwnership(unittest.TestCase):
    def setUp(self):
        missing = set(rec.SERIES['cpi']) - {'cpi_yoy', 'core_cpi_yoy', 'cpi_mom', 'core_cpi_mom'}
        if missing:
            self.skipTest(f'unexpected CPI metrics {missing}')

    def test_incomplete_month_does_not_steal_earlier_release_month(self):
        aug_release = cpi('2026-09-11', cpi_yoy='3.4%', core_cpi_yoy='2.4%', cpi_mom='0.4%', core_cpi_mom='0.3%')
        sep_release = cpi('2026-10-14', cpi_yoy='3.7%', core_cpi_yoy='2.6%', cpi_mom='0.6%', core_cpi_mom='0.3%')
        oct_release = cpi('2026-11-10', cpi_yoy=None, core_cpi_yoy=None, cpi_mom='0.4%', core_cpi_mom='0.3%')
        # Earlier releases are not reconciled in this pass (retry back-off), so
        # they are not yet VERIFIED_OFFICIAL and do not claim their months.
        for e in (aug_release, sep_release):
            e['official_reconcile_failed_kst'] = '2026-11-11T13:30:00+09:00'
        cal = {'events': [aug_release, sep_release, oct_release]}
        rec.apply(cal, {'series': {}}, NOW, fetch)
        m = {x['key']: x['actual'] for x in oct_release['market_metrics']}
        self.assertIsNone(m['cpi_yoy'])
        self.assertIsNone(m['core_cpi_yoy'])
        self.assertNotEqual((oct_release.get('official_reconcile') or {}).get('reference_period'), '2026-08')

    def test_usual_period(self):
        self.assertEqual(rec.usual_period({'datetime_kst': '2026-09-11T22:30+09:00'}, 'cpi'), '2026-08')
        self.assertEqual(rec.usual_period({'datetime_kst': 'bad'}, 'cpi'), None)


if __name__ == '__main__':
    unittest.main()
