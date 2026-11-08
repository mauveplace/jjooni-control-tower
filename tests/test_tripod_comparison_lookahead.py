import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_tripod_comparison import daily_suffix  # noqa: E402


class DailySuffixTest(unittest.TestCase):
    def test_period_bars_before_daily_tail_are_dropped(self):
        rows = [{'date': '2020-01-01', 'value': 1}, {'date': '2020-04-01', 'value': 2},  # quarterly
                {'date': '2023-09-08', 'value': 3}, {'date': '2023-09-11', 'value': 4},  # daily (weekend gap)
                {'date': '2023-09-12', 'value': 5}]
        self.assertEqual([r['date'] for r in daily_suffix(rows)], ['2023-09-08', '2023-09-11', '2023-09-12'])

    def test_all_coarse_or_single_row_yields_nothing(self):
        self.assertEqual(daily_suffix([{'date': '2020-01-01', 'value': 1}, {'date': '2020-04-01', 'value': 2}]), [])
        self.assertEqual(daily_suffix([{'date': '2020-01-01', 'value': 1}]), [])

    def test_real_archive_contributes_only_daily_rows(self):
        archive = json.loads((ROOT / 'market-observatory/data/history-30y.json').read_text(encoding='utf-8'))
        for key in ('NASDAQ100', 'VIX'):
            rows = daily_suffix(archive['series'][key])
            self.assertTrue(rows)
            self.assertGreaterEqual(rows[0]['date'], '2023-09-01', key)


class PublishedComparisonTest(unittest.TestCase):
    def test_no_quarter_start_spike_reversals(self):
        """Lookahead signature: a period-start row jumps and the next day undoes it."""
        rows = json.loads((ROOT / 'market-observatory/data/tripod-comparison.json').read_text(encoding='utf-8'))['rows']
        bad = []
        for prev, cur, nxt in zip(rows, rows[1:], rows[2:]):
            r1, r2 = cur[1] / prev[1] - 1, nxt[1] / cur[1] - 1
            period_start = cur[0][:7] != prev[0][:7]
            if period_start and abs(r1) > 0.08 and r1 * r2 < 0 and abs(r2) > 0.07:
                bad.append(cur[0])
        self.assertEqual(bad, [])


if __name__ == '__main__':
    unittest.main()
