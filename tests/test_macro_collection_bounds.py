import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import build_official_macro as macro


class CollectionBoundsTests(unittest.TestCase):
    def test_invalid_old_core_series_is_not_restored(self):
        old = {'metrics': {'KR_CORE_CPI': {'history':[{'raw':179.9}], 'latest':{'raw':179.9, 'value':9.24}}}}
        metrics = {'KR_CORE_CPI': {'status':'SOURCE_PENDING'}, 'KR_CPI': {'status':'LIVE','latest':{'raw':120.05}}}
        macro.retain_failed_metrics(metrics, old)
        self.assertNotIn('latest', metrics['KR_CORE_CPI'])
        self.assertIn('MISMATCH', metrics['KR_CORE_CPI']['error'])

    def test_exact_registry_needs_no_fuzzy_discovery(self):
        calls = []
        def collect(*args):
            calls.append((args[1], args[5]))
            return []
        with patch.object(macro, 'ecos_search', side_effect=collect):
            macro.build_kr({'events': []})
        self.assertIn(('200Y102','10111'), calls)
        self.assertIn(('901Y010','DB'), calls)
        self.assertEqual(len(calls), 7)

    def test_budget_stops_requests(self):
        with patch.object(macro, 'ECOS_DEADLINE', 10), patch.object(macro.time, 'monotonic', return_value=11), patch.object(macro, 'req_json') as request:
            with self.assertRaisesRegex(TimeoutError, 'BUDGET'):
                macro.ecos_request('sample', 'StatisticSearch', '1')
            request.assert_not_called()

    def test_repeated_page_stops_instead_of_looping(self):
        rows = [{'TIME': f'2025{i:02d}', 'DATA_VALUE': str(i)} for i in range(1, 11)]
        with patch.object(macro, 'load_json', return_value={}), patch.object(macro, 'ecos_request', return_value={'StatisticSearch': {'list_total_count': 10000, 'row': rows}}) as request:
            with self.assertRaisesRegex(RuntimeError, 'REPEATED_PAGE'):
                macro.ecos_search('sample', '722Y001', 'M', '201501', '202609', '0101000')
            self.assertEqual(request.call_count, 2)

    def test_incremental_refresh_preserves_history_and_revises_recent_value(self):
        old = {'metrics': {'KR_BASE_RATE': {'history': [{'period':'2015-01-01','raw':2}, {'period':'2026-08-01','raw':2.5}]}}}
        reply = {'StatisticSearch': {'list_total_count':1, 'row':[{'TIME':'202608','DATA_VALUE':'2.75'}]}}
        with patch.object(macro, 'load_json', return_value=old), patch.object(macro, 'ecos_request', return_value=reply) as request:
            result = macro.ecos_search('sample','722Y001','M','201501','202609','0101000')
        self.assertEqual(result, [{'date':'2015-01-01','value':2}, {'date':'2026-08-01','value':2.75}])
        self.assertGreater(request.call_args.args[6], '201501')

    def test_outage_preserves_values_without_claiming_live(self):
        old = {'generated_kst':'2026-09-21T00:00:00+09:00', 'metrics': {'KR_CPI': {'status':'LIVE','history':[{'period':'2026-08-01','raw':120}], 'latest':{'value':2.1}, 'release':{'actual':2.1}}}}
        metrics = {'KR_CPI': {'status':'DEGRADED', 'error':'HTTP 503'}}
        macro.retain_failed_metrics(metrics, old)
        self.assertEqual(metrics['KR_CPI']['release']['actual'],2.1)
        self.assertEqual(metrics['KR_CPI']['status'],'DEGRADED')
        self.assertEqual(macro.group_regimes(metrics)['kr']['inflation']['regime'],'DATA_PENDING')
        self.assertEqual(old['metrics']['KR_CPI']['status'],'LIVE')

    def test_api_error_not_empty_success(self):
        with patch.object(macro,'ECOS_DEADLINE',None), patch.object(macro,'req_json',return_value={'RESULT':{'CODE':'ERROR-100'}}):
            with self.assertRaisesRegex(RuntimeError,'ERROR-100'):
                macro.ecos_request('sample','StatisticSearch','1')
