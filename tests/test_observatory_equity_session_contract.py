import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import add_observatory_equities as eq


class ObservatoryEquitySessionContractTest(unittest.TestCase):
    def test_naver_index_uses_explicit_korean_trading_date(self):
        old=eq.get_json
        try:
            eq.get_json=lambda url:[
                {'localTradedAt':'2026-10-12','closePrice':'6,384.24'},
                {'localTradedAt':'2026-10-08','closePrice':'6,625.93'},
            ]
            rows,_=eq.naver_index_recent('KOSPI')
        finally:
            eq.get_json=old
        self.assertEqual(rows[-1],{'date':'2026-10-12','value':6384.24})

    def test_recent_primary_rows_correct_old_shifted_date(self):
        old=[{'date':'2026-10-07','value':6625.93}]
        fresh=[{'date':'2026-10-07','value':6803.90},{'date':'2026-10-08','value':6625.93}]
        merged=eq.merge_rows(old,fresh)
        self.assertEqual(merged[-2]['value'],6803.90)
        self.assertEqual(merged[-1],{'date':'2026-10-08','value':6625.93})

    def test_us_supplement_drops_same_day_provisional_bar(self):
        et=ZoneInfo('America/New_York')
        rows=[
            {'date':'2026-10-09','value':100.0},
            {'date':'2026-10-12','value':101.0},
        ]
        # Core target remains the last completed session, so supplemental US
        # indices must not show the in-progress 10/12 bar.
        self.assertEqual(eq.completed_us_rows(rows,'2026-10-09')[-1]['date'],'2026-10-09')

    def test_us_supplement_matches_new_core_session_after_close(self):
        rows=[
            {'date':'2026-10-09','value':100.0},
            {'date':'2026-10-12','value':101.0},
        ]
        old=eq.completed_us_cutoff
        try:
            eq.completed_us_cutoff=lambda now=None:'2026-10-12'
            self.assertEqual(eq.completed_us_rows(rows,'2026-10-12')[-1]['date'],'2026-10-12')
        finally:
            eq.completed_us_cutoff=old


if __name__=='__main__':
    unittest.main()
