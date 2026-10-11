import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import add_observatory_equities as equities


class CryptoObservationTest(unittest.TestCase):
    def test_weekend_candles_use_utc_and_current_quote_keeps_timestamp(self):
        utc = ZoneInfo('UTC')
        now = datetime(2026, 10, 11, 23, 15, tzinfo=utc)
        quote = int(now.timestamp())
        payload = {'chart': {'result': [{
            'meta': {'regularMarketPrice': 101, 'regularMarketTime': quote},
            'timestamp': [int(datetime(2026, 10, 10, tzinfo=utc).timestamp()), int(datetime(2026, 10, 11, tzinfo=utc).timestamp())],
            'indicators': {'quote': [{'close': [100, 100.5]}]},
        }]}}
        with patch.object(equities, 'get_json', return_value=payload):
            rows, snapshot = equities.crypto_observation('BTC-USD', now)
        self.assertEqual([r['date'] for r in rows], ['2026-10-10', '2026-10-11'])
        self.assertEqual(rows[-1]['value'], 101)
        self.assertEqual(rows[-1]['session_status'], 'IN_PROGRESS')
        self.assertEqual(snapshot['quote_as_of_kst'], '2026-10-12T08:15:00+09:00')
        self.assertEqual(snapshot['status'], 'LIVE')

    def test_provider_failure_preserves_last_verified_values_and_marks_stale(self):
        data = {'series': {'BTCUSD': [{'date': '2026-10-10', 'value': 100}]},
                'latest': {'BTCUSD': 100}, 'crypto_market': {'BTCUSD': {'price': 100}}}
        with patch.object(equities, 'crypto_observation', side_effect=RuntimeError('source unavailable')):
            equities.enrich_crypto(data)
        self.assertEqual(data['latest']['BTCUSD'], 100)
        self.assertEqual(data['series']['BTCUSD'][0]['value'], 100)
        self.assertEqual(data['crypto_market']['BTCUSD']['status'], 'STALE')
        self.assertEqual(data['crypto_market']['ETHUSD']['status'], 'UNAVAILABLE')

    def test_full_rebuild_retains_weekend_observation_until_refresh(self):
        previous={'series':{'BTCUSD':[{'date':'2026-10-11','value':101}]},'crypto_market':{'BTCUSD':{'status':'LIVE','quote_as_of_kst':'2026-10-12T08:15:00+09:00'}}}
        current={'series':{'SP500':[{'date':'2026-10-09','value':100}]}}
        equities.retain_crypto_observations(current,previous)
        self.assertEqual(current['series']['BTCUSD'][0]['date'],'2026-10-11')
        self.assertEqual(current['latest']['BTCUSD'],101)
        self.assertEqual(current['crypto_market']['BTCUSD']['status'],'STALE')
        self.assertEqual(previous['crypto_market']['BTCUSD']['status'],'LIVE')

    def test_quote_without_provider_timestamp_is_rejected(self):
        with patch.object(equities, 'get_json', return_value={'chart': {'result': [{'meta': {'regularMarketPrice': 101}}]}}):
            with self.assertRaisesRegex(ValueError, 'METADATA_MISSING'):
                equities.crypto_observation('ETH-USD')


if __name__ == '__main__':
    unittest.main()
