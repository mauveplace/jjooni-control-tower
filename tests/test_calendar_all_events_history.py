import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))

from enrich_calendar_all_events import text_score
from build_calendar_history import canonical_title
from sync_calendar_representative_values import primary_metric


class CalendarAllEventsHistoryTest(unittest.TestCase):
    def test_generic_market_title_match(self):
        self.assertGreater(text_score('Retail Sales', 'Retail Sales m/m'), 55)
        self.assertGreater(text_score('Consumer Price Index', 'CPI y/y'), 45)
        self.assertGreater(text_score('Producer Price Index', 'PPI m/m'), 45)

    def test_frequency_qualifier_separates_rows(self):
        yoy=text_score('Core CPI YoY Consumer Price Index','Core CPI y/y')
        mom=text_score('Core CPI YoY Consumer Price Index','Core CPI m/m')
        self.assertGreater(yoy,mom)

    def test_reference_period_does_not_split_history_family(self):
        a=canonical_title('Personal Income and Outlays, August 2026')
        b=canonical_title('Personal Income and Outlays, September 2026')
        self.assertEqual(a,b)
        c=canonical_title('2026년 8월 소비자물가동향')
        d=canonical_title('2026년 9월 소비자물가동향')
        self.assertEqual(c,d)

    def test_probability_overlay_cannot_be_representative(self):
        event={'market_metrics':[
            {'key':'fedwatch_hike_25bp','previous':'17.7%','consensus':'22.1%',
             'metric_type':'market_probability_snapshot'},
            {'key':'policy_rate','previous':'4.00%','consensus':'4.00%','actual':None,
             'source':'Federal Reserve'},
        ]}
        self.assertEqual(primary_metric(event)['key'],'policy_rate')


if __name__=='__main__':
    unittest.main()
