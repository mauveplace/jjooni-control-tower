import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import collect_us_rates_intraday as rates


class IntradayYieldTests(unittest.TestCase):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=ZoneInfo('Asia/Seoul'))

    def payload(self, symbol, stamps=None, values=None):
        return {'chart': {'result': [{'meta': {'symbol': symbol},
                'timestamp': stamps or [int(self.now.timestamp())-600, int(self.now.timestamp())-300],
                'indicators': {'quote': [{'close': values if values is not None else [5.2, 5.19]}]}}]}}

    def test_yield_units_and_real_timestamps_are_preserved(self):
        rows = rates.parse_payload(self.payload('^TNX'), '^TNX', self.now)
        self.assertEqual([r['yield_pct'] for r in rows], [5.2, 5.19])
        self.assertEqual(rows[1]['timestamp']-rows[0]['timestamp'], 300)

    def test_wrong_symbol_futures_price_and_future_clock_are_rejected(self):
        for doc in [self.payload('ZN=F'), self.payload('^TNX', values=[105.3, 105.4]),
                    self.payload('^TNX', stamps=[int(self.now.timestamp())+300]*2)]:
            with self.assertRaises(ValueError):
                rates.parse_payload(doc, '^TNX', self.now)

    def test_null_bars_are_not_fabricated_or_interpolated(self):
        rows = rates.parse_payload(self.payload('^TNX', values=[None, 5.19]), '^TNX', self.now)
        self.assertEqual(len(rows), 1)

    def test_source_failure_preserves_last_observations_and_other_tenors(self):
        stamp = int(self.now.timestamp())-3600
        previous = {'series': {'US10Y': {'points': [{'timestamp':stamp,'yield_pct':5.22}], 'last_success_kst':'old'}}}
        def fetch(symbol):
            if symbol == '^TNX': raise RuntimeError('source offline')
            return self.payload(symbol)
        doc = rates.build(previous, self.now, fetch, self.payload)
        self.assertEqual(doc['series']['US10Y']['state'], 'STALE')
        self.assertEqual(doc['series']['US10Y']['points'][0]['yield_pct'],5.22)
        self.assertEqual(doc['series']['US30Y']['state'],'AVAILABLE')

    def test_overlapping_fetches_deduplicate_and_retention_is_bounded(self):
        recent = int(self.now.timestamp())-300
        old = int((self.now-timedelta(days=31)).timestamp())
        doc = rates.build({'series': {'US10Y': {'points':[{'timestamp':old,'yield_pct':4.0},{'timestamp':recent,'yield_pct':5.21}]}}},self.now,self.payload,self.payload)
        rows = doc['series']['US10Y']['points']
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[-1]['yield_pct'],5.19)

    def test_completed_day_tracks_ny_close_weekend_and_dst(self):
        for stamp, expected in [('2026-03-09T19:00:00+00:00','2026-03-06'),
                                ('2026-03-09T21:00:00+00:00','2026-03-09'),
                                ('2026-11-02T21:00:00+00:00','2026-10-30'),
                                ('2026-11-02T22:00:00+00:00','2026-11-02')]:
            self.assertEqual(rates.completed_day(datetime.fromisoformat(stamp)),expected)

    def test_daily_failure_is_independent_and_preserves_history(self):
        old = [{'timestamp':int(self.now.timestamp())-86400,'yield_pct':5.1}]
        def fail(_): raise RuntimeError('daily offline')
        doc = rates.build({'series':{'US10Y':{'daily_points':old}}},self.now,self.payload,fail)
        self.assertEqual(doc['series']['US10Y']['state'],'AVAILABLE')
        self.assertEqual(doc['series']['US10Y']['daily_state'],'STALE')
        self.assertEqual(doc['series']['US10Y']['daily_points'],old)

    def test_daily_cache_and_unfinished_session_filter(self):
        now = datetime.fromisoformat('2026-10-15T18:00:00+00:00')
        stamps=[int(datetime.fromisoformat(x).timestamp()) for x in ['2026-10-14T13:30:00+00:00','2026-10-15T13:30:00+00:00']]
        daily=lambda symbol:self.payload(symbol,stamps,[5.1,5.2])
        doc = rates.build(None,now,self.payload,daily)
        self.assertEqual(len(doc['series']['US10Y']['daily_points']),1)
        def forbidden(_): raise AssertionError('cached daily source fetched again')
        again=rates.build(doc,now,self.payload,forbidden)
        self.assertEqual(again['series']['US10Y']['daily_state'],'AVAILABLE')
        self.assertEqual(again['series']['US10Y']['daily_points'],doc['series']['US10Y']['daily_points'])


if __name__ == '__main__': unittest.main()
