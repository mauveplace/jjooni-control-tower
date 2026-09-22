import json
from datetime import date
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from bs4 import BeautifulSoup
import build_official_macro as macro
import official_macro_releases as release
from official_macro_registry import KR_SERIES, validate_rows

FIX = json.loads((Path(__file__).parent / 'fixtures/macro-sources.json').read_text())
def soup(text):
    return BeautifulSoup(text, 'html.parser')


class MacroReleaseTests(unittest.TestCase):
    def test_verified_ecos_codes_and_units(self):
        for key, fixture in [('KR_GDP', 'gdp'), ('KR_CORE_CPI', 'core'), ('KR_INDUSTRIAL_PRODUCTION', 'production')]:
            rows = FIX[fixture]['StatisticSearch']['row']
            validate_rows(rows, KR_SERIES[key])
            bad = dict(rows[0], UNIT_NAME='USD')
            with self.assertRaisesRegex(ValueError, 'MISMATCH'):
                validate_rows([bad], KR_SERIES[key])

    def test_production_value_is_mom_not_yoy(self):
        rows = [{'date': f'2025-{i:02d}-01', 'value':100+i} for i in range(1,13)] + [{'date':'2026-01-01','value':112}]
        latest = macro.metric_history('monthly_mom', rows)[-1]
        self.assertEqual(latest['value'], 0)
        self.assertNotEqual(latest['value'], latest['yoy'])

    def test_core_history_cannot_reuse_wrong_discovered_series(self):
        old = {'metrics':{'KR_CORE_CPI':{'history':[{'period':'2015-01-01','raw':999}]}}}
        response = FIX['core']
        with patch.object(macro, 'load_json', return_value=old), patch.object(macro, 'ecos_request', return_value=response):
            points = macro.ecos_search('sample','901Y010','M','201501','202608','DB')
        self.assertNotIn(999, [p['value'] for p in points])

    def test_employment_compound_korean_units_and_negative_sign(self):
        metric = release.parse_employment(soup(FIX['employment']), 'https://mods.go.kr/test')
        self.assertEqual(metric['release']['actual'],184)
        self.assertEqual(metric['components']['employed_thousands'],29151)
        self.assertEqual(metric['latest']['period'],'2026-08-01')
        negative = FIX['employment'].replace('18만 4천명(0.6%) 증가','18만 4천명(-0.6%) 감소')
        self.assertEqual(release.parse_employment(soup(negative),'https://mods.go.kr/test')['release']['actual'],-184)

    def test_customs_discovery_keeps_required_detail_token(self):
        links = release.customs_links(soup(FIX['customs_links']))
        self.assertTrue(any('10176743&nttSnUrl=0b6477a0d2c425948fd0866c7b527f24' in url for _, url in links))

    def test_monthly_exports_and_semiconductors_have_separate_values(self):
        result = release.parse_customs(soup(FIX['customs']), 'https://www.customs.go.kr/test')
        self.assertEqual([m['release']['actual'] for m in result],[68.7,206.1])
        self.assertEqual(result[0]['latest']['period'],'2026-08-01')
        self.assertGreaterEqual(len(result[1]['history']),8)
        with self.assertRaises(ValueError):
            release.parse_customs(soup(FIX['customs']),'https://www.customs.go.kr/test',early=True)

    def test_wrong_early_window_fails_closed(self):
        text = '2026년 9월 1일 ~ 9월 10일 수출입 현황 등록일 2026.09.11 전년동기대비 수출 78.3%'
        with self.assertRaises(ValueError):
            release.parse_customs(soup(text),'https://www.customs.go.kr/test',early=True)
        text = text.replace('10일','20일')
        self.assertEqual(release.parse_customs(soup(text),'https://www.customs.go.kr/test',early=True)[0]['release']['actual'],78.3)

    def test_sep_medians_are_forecasts_not_actuals(self):
        html = '<table>' + ''.join('<tr>'+''.join('<td>'+cell+'</td>' for cell in row)+'</tr>' for row in FIX['fed_table'])+'</table>'
        metric = release.parse_sep(soup(html),'https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm')
        self.assertIsNone(metric['release']['actual'])
        self.assertFalse(metric['actual_expected'])
        self.assertEqual(metric['release']['forecast'],4.1)
        self.assertEqual(metric['projections']['fed_funds']['2028'],3.9)
        self.assertEqual(metric['projections']['core_pce']['2026'],3.4)

    def test_bok_summary_preserves_years_and_forecast_role(self):
        metric = release.parse_bok_outlook(FIX['bok_summary'],'https://www.bok.or.kr/test','2026-08-27')
        self.assertEqual(metric['projections']['gdp'],{'2026':3.3,'2027':2.9})
        self.assertEqual(metric['projections']['cpi']['2026'],2.7)
        self.assertIsNone(metric['release']['actual'])
        self.assertEqual(metric['release']['forecast'],3.3)

    def test_adapter_failure_does_not_stop_other_collectors(self):
        def good():
            return [release.payload('KR_EMPLOYMENT','employment','labor','KOSTAT','2026-08-01',184,'https://mods.go.kr/test','2026-09-09')]
        def bad():
            raise ValueError('changed HTML')
        adapters = {'good':(good,[('KR_EMPLOYMENT','employment','KOSTAT')]), 'bad':(bad,[('KR_BOK_OUTLOOK','outlook','BOK')])}
        with patch.object(release,'RELEASE_ADAPTERS',adapters):
            metrics, errors = release.collect_releases({}, date(2026,9,22))
        self.assertEqual(metrics['KR_EMPLOYMENT']['status'],'LIVE')
        self.assertEqual(metrics['KR_BOK_OUTLOOK']['status'],'DEGRADED')
        self.assertIn('changed HTML',errors['KR_BOK_OUTLOOK'])

    def test_old_publication_cannot_be_live_forever(self):
        metric = release.payload('KR_EMPLOYMENT','employment','labor','KOSTAT','2026-07-01',10,'https://mods.go.kr/test','2026-08-12')
        self.assertIsNotNone(release.freshness_error(metric,date(2026,9,22)))

    def test_new_degraded_observation_does_not_regress_to_old_period(self):
        metrics = {'KR_EMPLOYMENT':{'status':'DEGRADED','history':[{'period':'2026-08-01','value':184}], 'latest':{'period':'2026-08-01','value':184}}}
        old = {'metrics':{'KR_EMPLOYMENT':{'history':[{'period':'2026-07-01','value':10}], 'latest':{'period':'2026-07-01','value':10}}}}
        macro.retain_failed_metrics(metrics,old)
        self.assertEqual(metrics['KR_EMPLOYMENT']['latest']['value'],184)
