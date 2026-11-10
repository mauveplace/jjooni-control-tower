"""BLS one-off nonpublication and credential-safe error handling."""
import json
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from calendar_actual_contract import build_freshness
from official_bls_api import fetch_series


class OfficialCpiNonpublication(unittest.TestCase):
    def event(self, day='2026-11-10', verified=True):
        mom = {'key': 'cpi_mom', 'actual': '0.4%',
               'source_tier': 'OFFICIAL' if verified else 'MARKET_FEED',
               'verification_status': 'VERIFIED_OFFICIAL_REVISED' if verified else 'UNVERIFIED',
               'reference_period': '2026-10',
               'source_url': 'https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0'}
        return {'title': 'Consumer Price Index', 'country': 'US',
                'importance': 3, 'datetime_kst': day + 'T22:30:00+09:00',
                'actual': None, 'market_metrics': [
                    {'key': 'cpi_yoy', 'actual': None},
                    mom,
                    {'key': 'core_cpi_yoy', 'actual': None},
                    {'key': 'core_cpi_mom', 'actual': '0.3%',
                     'source_tier': 'OFFICIAL', 'actual_expected': True}]}

    def check(self, event):
        d = {'events': [event]}
        status = build_freshness(d, datetime(2026, 11, 11, 7, 30,
                                             tzinfo=ZoneInfo('Asia/Seoul')), [])
        return status, d['events'][0]

    def test_officially_missing_yoy_is_not_overdue_when_mom_verified(self):
        status, event = self.check(self.event())
        self.assertEqual(status['status'], 'LIVE')
        self.assertEqual(event['actual'], '0.4%')
        self.assertEqual(event['representative_metric_key'], 'cpi_mom')
        self.assertEqual([m['availability_status'] for m in event['market_metrics']
                          if m['key'] in ('cpi_yoy','core_cpi_yoy')],
                         ['OFFICIALLY_NOT_PUBLISHED', 'OFFICIALLY_NOT_PUBLISHED'])
        self.assertIsNone(event['market_metrics'][0]['actual'])
        self.assertEqual(event['actual_source'], 'BLS API official series')

    def test_feed_only_is_not_promoted_to_official(self):
        status, event = self.check(self.event(verified=False))
        self.assertEqual(status['status'], 'DEGRADED')
        self.assertIsNone(event['actual'])

    def test_other_dates_still_require_yoy_and_headline(self):
        status, event = self.check(self.event(day='2026-11-09'))
        self.assertEqual(status['status'], 'DEGRADED')
        self.assertNotIn('official_nonpublication', event)

    def test_idempotent_marking(self):
        event = self.event()
        self.check(event)
        first=json.dumps(event,sort_keys=True)
        self.check(event)
        self.assertEqual(first,json.dumps(event,sort_keys=True))


class BLSKeyPrivacy(unittest.TestCase):
    def tearDown(self):
        fetch_series.cache_clear()

    def test_invalid_key_retries_anonymous_without_leaking(self):
        fetch_series.cache_clear()
        key='not-a-valid-bls-key'
        def remote(url):
            if 'registrationkey=' in url:
                return json.dumps({'status':'REQUEST_NOT_PROCESSED',
                                   'message':[f'The key:{key} provided by the User is invalid']}).encode()
            return json.dumps({'status':'REQUEST_SUCCEEDED',
                               'Results':{'series':[{'seriesID':'CUUR0000SA0',
                                                     'data':[{'year':'2026','period':'M10','value':'320.4'}]}]}}).encode()
        with patch.dict(os.environ,{'BLS_API_KEY':key}), patch('official_calendar_collectors.raw_fetch', side_effect=remote):
            values,url=fetch_series('CUUR0000SA0',2026)
        self.assertEqual(str(values[(2026,10)]),'320.4')
        self.assertNotIn(key,url)

    def test_invalid_key_and_keyless_failure_remain_redacted(self):
        fetch_series.cache_clear()
        key='not-a-valid-bls-key'
        def remote(url):
            if 'registrationkey=' in url:
                return json.dumps({'status':'REQUEST_NOT_PROCESSED',
                                   'message':[f'The key:{key} provided by the User is invalid']}).encode()
            return json.dumps({'status':'REQUEST_NOT_PROCESSED','message':['daily limit reached']}).encode()
        with patch.dict(os.environ,{'BLS_API_KEY':key}), patch('official_calendar_collectors.raw_fetch',side_effect=remote):
            with self.assertRaisesRegex(ValueError,'BLS_API_KEY_INVALID_KEYLESS_REJECTED') as cm:
                fetch_series('CUUR0000SA0',2026)
        self.assertNotIn(key,str(cm.exception))


if __name__=='__main__':
    unittest.main()
