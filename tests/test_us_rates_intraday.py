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
        doc = rates.build(previous, self.now, fetch)
        self.assertEqual(doc['series']['US10Y']['state'], 'STALE')
        self.assertEqual(doc['series']['US10Y']['points'][0]['yield_pct'],5.22)
        self.assertEqual(doc['series']['US30Y']['state'],'AVAILABLE')

    def test_overlapping_fetches_deduplicate_and_retention_is_bounded(self):
        recent = int(self.now.timestamp())-300
        old = int((self.now-timedelta(days=31)).timestamp())
        doc = rates.build({'series': {'US10Y': {'points':[{'timestamp':old,'yield_pct':4.0},{'timestamp':recent,'yield_pct':5.21}]}}},self.now,self.payload)
        rows = doc['series']['US10Y']['points']
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[-1]['yield_pct'],5.19)


if __name__ == '__main__': unittest.main()
