import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import refresh_observatory_supplementals as mod
from publish_observatory_data import merge_generated

class USRatesRefresh(unittest.TestCase):
    def test_card_sources_advance_without_daily_builder_and_exclude_open_session(self):
        data={'us_completed_session_date':'2026-10-26','series':{},'latest':{}}
        treasury=[{'date':'2026-10-26','values':{'2 Yr':4.68,'10 Yr':5.0}}]
        with patch.object(mod,'completed_us_cutoff',return_value='2026-10-26'),patch.object(mod,'yahoo_series',return_value=[{'date':'2026-10-26','value':4.986},{'date':'2026-10-27','value':9}]),patch('build_market_observatory.treasury_rows',return_value=treasury):
            mod.refresh_us_rates(data)
        self.assertEqual(data['series']['US10Y'][-1],{'date':'2026-10-26','value':4.986})
        self.assertEqual(data['latest']['US2Y'],4.68)
        self.assertEqual(data['latest']['US_2S10S'],.32)
        self.assertEqual(data['cross_market_freshness_quality']['US10Y']['status'],'LIVE')

    def test_one_failed_source_retains_observation_and_other_sources_advance(self):
        data={'us_completed_session_date':'2026-10-26','series':{'US2Y':[{'date':'2026-10-23','value':4.69}]}}
        with patch.object(mod,'completed_us_cutoff',return_value='2026-10-26'),patch.object(mod,'yahoo_series',return_value=[{'date':'2026-10-26','value':4.986}]),patch('build_market_observatory.treasury_rows',side_effect=TimeoutError('timeout')):
            mod.refresh_us_rates(data)
        self.assertEqual(data['latest']['US2Y'],4.69)
        self.assertEqual(data['cross_market_freshness_quality']['US2Y']['status'],'STALE')
        self.assertEqual(data['series']['US10Y'][-1]['date'],'2026-10-26')

    def test_later_main_build_cannot_drop_independent_rates_refresh(self):
        remote={'generated_kst':'2026-10-27T10:00:00+09:00','us_completed_session_date':'2026-10-26','series':{'US10Y':[{'date':'2026-10-23','value':5}]}}
        local={'generated_kst':'2026-10-27T08:00:00+09:00','us_completed_session_date':'2026-10-26','us_rates_refreshed_kst':'2026-10-27T09:00:00+09:00','series':{'US10Y':[{'date':'2026-10-26','value':4.986}]}}
        result=merge_generated('market-observatory/data/observatory.json',local,remote)
        self.assertEqual(result['latest']['US10Y'],4.986)
        self.assertEqual(result['generated_kst'],remote['generated_kst'])
        self.assertEqual(len(result['series']['US10Y']),2)
