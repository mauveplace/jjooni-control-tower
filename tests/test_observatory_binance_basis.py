"""Regression: Binance USDT prices must never be compared to fiat USD closes."""
import sys
import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import add_observatory_equities as crypto
import build_daily_glance as glance

UTC=ZoneInfo('UTC')


class BinanceBasisTest(unittest.TestCase):
    def test_verified_previous_utc_kline(self):
        now=datetime(2026,11,10,1,0,tzinfo=UTC)
        start=int(datetime(2026,11,9,tzinfo=UTC).timestamp()*1000)
        bar=[[start,'0','0','0','75000.25','0',start+86400000-1]]
        with patch.object(crypto,'get_json',return_value=bar) as getter:
            row=crypto.binance_completed_utc_day('BTCUSD','2026-11-09',now)
        self.assertEqual((row['session_status'],row['quote_currency']),('COMPLETED','USDT'))
        self.assertEqual(row['value'],75000.25)
        self.assertIn('interval=1d',getter.call_args.args[0])

    def test_unfinished_or_inconsistent_kline_rejected(self):
        now=datetime(2026,11,10,1,0,tzinfo=UTC)
        start=int(datetime(2026,11,9,tzinfo=UTC).timestamp()*1000)
        for bar in ([],[{'wrong':'shape'}],[[0,0,0,0,100,0,0]],
                    [[start,0,0,0,'NaN',0,start+86400000-1]]):
            with self.subTest(bar=bar),patch.object(crypto,'get_json',return_value=bar):
                with self.assertRaises((ValueError,TypeError,OverflowError)):
                    crypto.binance_completed_utc_day('BTCUSD','2026-11-09',now)
        with patch.object(crypto,'get_json',return_value=[]):
            with self.assertRaisesRegex(ValueError,'NOT_COMPLETE'):
                crypto.binance_completed_utc_day('BTCUSD','2026-11-10',now)

    def test_native_previous_close_overrides_legacy_fiat_history(self):
        today=datetime.now(UTC).date()
        day=today.isoformat()
        prev=(today-timedelta(days=1)).isoformat()
        live=([{'date':day,'value':101,'session_status':'IN_PROGRESS',
                'quote_currency':'USDT'}],
              {'price':101,'status':'LIVE','source':'Binance','quote_currency':'USDT'})
        bar={'date':prev,'value':100,'session_status':'COMPLETED',
             'quote_currency':'USDT','source':'Binance UTC 1d kline'}
        data={'series':{'BTCUSD':[{'date':prev,'value':99,'session_status':'COMPLETED'}]}}
        with ExitStack() as stack:
            stack.enter_context(patch.object(crypto,'binance_spot_observations',return_value={'BTCUSD':live}))
            stack.enter_context(patch.object(crypto,'coingecko_spot_observations',return_value={}))
            stack.enter_context(patch.object(crypto,'binance_completed_utc_day',return_value=bar))
            stack.enter_context(patch.object(crypto,'crypto_observation',side_effect=OSError('Yahoo unavailable')))
            crypto.enrich_crypto(data)
        self.assertEqual(data['series']['BTCUSD'][-2]['value'],100)
        self.assertEqual(data['series']['BTCUSD'][-2]['quote_currency'],'USDT')
        self.assertTrue(data['crypto_market']['BTCUSD']['daily_change_safe'])
        item=glance.metric('BTCUSD','비트코인',data['series']['BTCUSD'],data['crypto_market']['BTCUSD'])
        self.assertEqual(item['d1_pct'],1.0)
        self.assertEqual(item['quote_currency'],'USDT')

    def test_no_fake_previous_close_when_kline_and_yahoo_fail(self):
        today=datetime.now(UTC).date()
        day=today.isoformat()
        prev=(today-timedelta(days=1)).isoformat()
        live=([{'date':day,'value':101,'session_status':'IN_PROGRESS',
                'quote_currency':'USDT'}],
              {'price':101,'status':'LIVE','source':'Binance','quote_currency':'USDT'})
        original={'date':prev,'value':100,'session_status':'IN_PROGRESS',
                  'quote_currency':'USDT','source':'Binance'}
        data={'series':{'BTCUSD':[original]}}
        with ExitStack() as stack:
            stack.enter_context(patch.object(crypto,'binance_spot_observations',return_value={'BTCUSD':live}))
            stack.enter_context(patch.object(crypto,'coingecko_spot_observations',return_value={}))
            stack.enter_context(patch.object(crypto,'binance_completed_utc_day',side_effect=OSError('kline unavailable')))
            stack.enter_context(patch.object(crypto,'crypto_observation',side_effect=OSError('Yahoo unavailable')))
            crypto.enrich_crypto(data)
        self.assertEqual(data['series']['BTCUSD'][0]['session_status'],'IN_PROGRESS')
        self.assertFalse(data['crypto_market']['BTCUSD']['daily_change_safe'])
        item=glance.metric('BTCUSD','비트코인',data['series']['BTCUSD'],data['crypto_market']['BTCUSD'])
        self.assertIsNone(item['d1_pct'])
        self.assertEqual(item['comparison_status'],'CURRENCY_BASIS_UNAVAILABLE')

    def test_different_currencies_have_no_derived_return(self):
        rows=[{'date':'2026-11-09','value':100,'session_status':'COMPLETED','quote_currency':'USD'},
              {'date':'2026-11-10','value':101,'session_status':'IN_PROGRESS','quote_currency':'USDT'}]
        now={'status':'LIVE','quote_currency':'USDT','source':'Binance'}
        item=glance.metric('BTCUSD','비트코인',rows,now)
        self.assertEqual(item['value'],101)
        self.assertIsNone(item['d1_pct'])
        self.assertEqual(item['comparison_status'],'CURRENCY_BASIS_UNAVAILABLE')

    def test_coingecko_quotes_explicitly_fiat_usd(self):
        now=datetime(2026,11,10,3,tzinfo=UTC)
        payload={'bitcoin':{'usd':75000,'last_updated_at':int(now.timestamp())-10},
                 'ethereum':{'usd':2200,'last_updated_at':int(now.timestamp())-10}}
        with patch.object(crypto,'get_json',return_value=payload):
            result=crypto.coingecko_spot_observations(now)
        self.assertEqual(result['BTCUSD'][0][0]['quote_currency'],'USD')
        self.assertEqual(result['ETHUSD'][1]['quote_currency'],'USD')

    def test_midnight_previous_date_last_trade_not_reclassified_as_today(self):
        now=datetime(2026,11,10,0,0,2,tzinfo=UTC)
        old=datetime(2026,11,9,23,59,59,tzinfo=UTC)
        with patch.object(crypto,'get_json',return_value=[{'price':'100','time':int(old.timestamp()*1000)}]):
            self.assertEqual(crypto.binance_spot_observations(now),{})

    def test_binance_http_429_is_per_symbol_and_falls_back(self):
        import urllib.error
        now=datetime(2026,11,10,1,tzinfo=UTC)
        def fetch(url):
            if 'BTCUSDT' in url:return [{'price':'100','time':int(now.timestamp()*1000)}]
            raise urllib.error.HTTPError(url,429,'Too Many Requests',{},None)
        with patch.object(crypto,'get_json',side_effect=fetch):
            quotes=crypto.binance_spot_observations(now)
        self.assertEqual(set(quotes),{'BTCUSD'})

if __name__=='__main__':
    unittest.main()
