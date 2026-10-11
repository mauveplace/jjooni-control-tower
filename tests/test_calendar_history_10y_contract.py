import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))

import build_calendar_history as history_builder
import backfill_calendar_history_forexfactory as ff


class CalendarHistoryTenYearContractTest(unittest.TestCase):
    def test_window_is_ten_years(self):
        self.assertEqual(history_builder.WINDOW_DAYS,3650)
        self.assertEqual(ff.WINDOW_DAYS,3650)

    def test_generic_unmatched_rows_are_retained(self):
        row={'country':'US','title':'Some Historical Indicator'}
        match=ff.generic_match(row)
        self.assertFalse(match['canonical'])
        self.assertEqual(match['kind'],'event')
        self.assertTrue(match['ref'].startswith('FF::US::'))

    def test_failed_weeks_are_retried_even_after_early_coverage(self):
        today=date.today()
        start=today-timedelta(days=3650)
        failed=(start+timedelta(days=400)).isoformat()
        # available_from before target start means no contiguous old segment is
        # otherwise requested; failed-week metadata must still force a retry.
        weeks=ff.target_weeks(start,(start-timedelta(days=30)).isoformat(),[failed])
        expected=ff.sunday_on_or_before(date.fromisoformat(failed))
        self.assertIn(expected,weeks)

    def test_official_actual_is_not_overwritten(self):
        bucket={'rows':[{
            'date':'2020-01-01','metric_key':'x','actual':'1.0%',
            'source':'Official','source_tier':'OFFICIAL'
        }]}
        incoming={
            'date':'2020-01-01','metric_key':'x','actual':'9.9%',
            'source':'Market','source_tier':'MARKET_FEED','previous':'0.8%'
        }
        ff.merge_history_row(bucket,incoming)
        self.assertEqual(bucket['rows'][0]['actual'],'1.0%')
        self.assertEqual(bucket['rows'][0]['previous'],'0.8%')


if __name__=='__main__':
    unittest.main()
