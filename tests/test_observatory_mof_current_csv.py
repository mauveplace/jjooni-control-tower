"""MOF current/historical JGB provenance and fail-closed regression tests."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import build_market_observatory as mod


HISTORICAL = 'Date,2Y,5Y,10Y,30Y\n2026/09/30,1.2,1.5,2.0,3.0\n'
CURRENT = 'Date,2Y,5Y,10Y,30Y\n2026/10/26,1.3,1.6,2.1,3.1\n'


class MofCurrentCsvTests(unittest.TestCase):
    def test_merges_historical_and_current_without_inventing_dates(self):
        with patch.object(mod, 'get_text', side_effect=[HISTORICAL, CURRENT]):
            rows = mod.jgb_rows()
        self.assertEqual([r['date'] for r in rows], ['2026-09-30', '2026-10-26'])
        self.assertEqual(rows[-1]['values']['10Y'], 2.1)

    def test_current_official_file_wins_on_same_date(self):
        current = 'Date,2Y,5Y,10Y,30Y\n2026/09/30,1.4,1.7,2.2,3.2\n'
        with patch.object(mod, 'get_text', side_effect=[HISTORICAL, current]):
            rows = mod.jgb_rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['values']['10Y'], 2.2)

    def test_current_unavailable_preserves_historical_vintage(self):
        with patch.object(mod, 'get_text', side_effect=[HISTORICAL, OSError('offline')]):
            rows = mod.jgb_rows()
        self.assertEqual(rows[-1]['date'], '2026-09-30')

    def test_no_official_source_fails_closed(self):
        with patch.object(mod, 'get_text', side_effect=[OSError('offline'), OSError('offline')]):
            with self.assertRaisesRegex(RuntimeError, 'JGB_MOF_NO_OFFICIAL_ROWS'):
                mod.jgb_rows()

    def test_malformed_current_file_never_fabricates_rows(self):
        with patch.object(mod, 'get_text', side_effect=[HISTORICAL, '<html>blocked</html>']):
            rows = mod.jgb_rows()
        self.assertEqual(rows[-1]['date'], '2026-09-30')


if __name__ == '__main__':
    unittest.main()
