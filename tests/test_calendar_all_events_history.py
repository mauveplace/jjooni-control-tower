import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))

from enrich_calendar_all_events import text_score
from build_calendar_history import canonical_title
from sync_calendar_representative_values import primary_metric
from backfill_calendar_history_forexfactory import best_catalog_match
from backfill_calendar_history_forexfactory_v2 import parse_page


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

    def test_historical_ff_parser_carries_date_and_time(self):
        html='''<table class="calendar__table"><tbody>
        <tr class="calendar__row calendar_row">
          <td class="calendar__cell calendar__date date">Wed Oct 15</td>
          <td class="calendar__cell calendar__time time">1:30pm</td>
          <td class="calendar__cell calendar__currency currency">USD</td>
          <td class="calendar__cell calendar__event event">Core CPI y/y</td>
          <td class="calendar__cell calendar__actual actual">3.0%</td>
          <td class="calendar__cell calendar__forecast forecast"><span>3.1%</span></td>
          <td class="calendar__cell calendar__previous previous"><span>3.2%</span></td>
        </tr>
        <tr class="calendar__row calendar_row">
          <td class="calendar__cell calendar__date date"></td>
          <td class="calendar__cell calendar__time time"></td>
          <td class="calendar__cell calendar__currency currency">USD</td>
          <td class="calendar__cell calendar__event event">CPI m/m</td>
          <td class="calendar__cell calendar__actual actual">0.2%</td>
          <td class="calendar__cell calendar__forecast forecast">0.3%</td>
          <td class="calendar__cell calendar__previous previous">0.4%</td>
        </tr></tbody></table>'''
        rows=parse_page(html,2025)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['country'],'US')
        self.assertEqual(rows[0]['consensus'],'3.1%')
        self.assertEqual(rows[1]['source_date'],'2025-10-15')
        self.assertEqual(rows[1]['source_time'],'1:30pm')
        self.assertTrue(rows[0]['datetime_kst'].startswith('2025-10-15T21:30'))

    def test_historical_ff_parser_accepts_responsive_div_rows(self):
        html='''<div>Calendar Time Zone: Europe/London</div>
        <div class="calendar__table">
          <div data-eventid="x1" class="calendar_row--responsive">
            <span class="calendar-date">Wed Oct 15</span>
            <span class="calendar-time">1:30pm</span>
            <span class="calendar-currency">USD</span>
            <span class="calendar-event">Core CPI y/y</span>
            <span class="calendar-actual">3.0%</span>
            <span class="calendar-forecast">3.1%</span>
            <span class="calendar-previous">3.2%</span>
          </div>
          <div data-eventid="x2" class="calendar_row--responsive">
            <span class="calendar-date"></span>
            <span class="calendar-time"></span>
            <span class="calendar-currency">USD</span>
            <span class="calendar-event">CPI m/m</span>
            <span class="calendar-actual">0.2%</span>
            <span class="calendar-forecast">0.3%</span>
            <span class="calendar-previous">0.4%</span>
          </div>
        </div>'''
        rows=parse_page(html,2025)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['title'],'Core CPI y/y')
        self.assertEqual(rows[1]['previous'],'0.4%')
        self.assertTrue(rows[1]['datetime_kst'].startswith('2025-10-15T21:30'))

    def test_historical_metric_match_prefers_granular_family(self):
        catalog={
            'metric':[
                {'ref':'US::consumer-price-index::cpi_yoy','country':'US','label':'CPI YoY','event_title':'Consumer Price Index','metric_key':'cpi_yoy'},
                {'ref':'US::consumer-price-index::cpi_mom','country':'US','label':'CPI MoM','event_title':'Consumer Price Index','metric_key':'cpi_mom'},
            ],
            'event':[
                {'ref':'US::consumer-price-index','country':'US','label':'Consumer Price Index','event_title':'Consumer Price Index','metric_key':None},
            ],
        }
        row={'country':'US','title':'CPI y/y'}
        match=best_catalog_match(row,catalog)
        self.assertIsNotNone(match)
        self.assertEqual(match['ref'],'US::consumer-price-index::cpi_yoy')


if __name__=='__main__':
    unittest.main()
