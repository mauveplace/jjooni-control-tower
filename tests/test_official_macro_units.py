import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from build_official_macro import market_num, calendar_consensus


class OfficialMacroUnitTests(unittest.TestCase):
    def test_market_headcounts_normalized_to_thousands(self):
        for raw, expected in [('7.33M',7330),('7.33m ',7330),('7,330K',7330),('196K',196),('-0.092M',-92)]:
            for key in ('US_JOLTS','US_NFP'):
                self.assertAlmostEqual(market_num(key,raw),expected)

    def test_percentage_not_scaled_and_missing_not_zero(self):
        self.assertEqual(market_num('US_CPI','0.3%'),0.3)
        self.assertEqual(market_num('US_NFP',0),0)
        self.assertIsNone(market_num('US_JOLTS',None))

    def test_latest_release_does_not_borrow_old_consensus(self):
        events=[dict(country='US',title='Job Openings and Labor Turnover Survey',
                     datetime_kst=date,market_metrics=[dict(key='jolts',consensus=value)])
                for date,value in [('2026-08-04T23:00+09:00','7.3M'),('2026-09-01T23:00+09:00',None)]]
        result=calendar_consensus('US_JOLTS',{'events':events})
        self.assertEqual(result['event_kst'],'2026-09-01T23:00+09:00')
        self.assertIsNone(result['consensus'])
