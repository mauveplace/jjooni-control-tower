import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from calendar_actual_contract import KST, merge_observation, retain_calendar, build_freshness
from official_bls_actuals import DEFS, cached_document, parse_bls, release_documents
from official_bls_api import calculate, collect_api, reference_month
from refresh_official_central_bank_actuals import apply_fomc_official_actual, fed_target_upper_from_statement
from publish_observatory_data import merge_generated


class PipelineRegressionTests(unittest.TestCase):
    def test_all_preserved_official_documents_parse(self):
        for url in release_documents():
            code, date = url.rsplit('/', 1)[-1].split('.')[0].split('_')
            if code not in {x[0] for x in DEFS.values()}:
                continue
            with self.subTest(url=url):
                rows, _ = parse_bls(cached_document(url)[0], code, datetime.strptime(date, '%m%d%Y'))
                expected = next(keys for kind, keys in DEFS.values() if kind == code)
                if any(m['key'] == 'state_jolts_annual_publication' for m in rows):
                    expected = ('state_jolts_annual_publication',)
                self.assertTrue(set(expected) <= {m['key'] for m in rows})

    def test_employment_negative_and_parenthesized_headlines(self):
        for stamp, expected in [('08072026', '-23K'), ('03062026', '-92K'),
                                ('07022026', '57K'), ('01092026', '50K')]:
            url = f'https://www.bls.gov/news.release/archives/empsit_{stamp}.htm'
            rows, _ = parse_bls(cached_document(url)[0], 'empsit', datetime.strptime(stamp, '%m%d%Y'))
            self.assertEqual(next(m['actual'] for m in rows if m['key'] == 'nfp'), expected)

    def test_removed_wrong_metrics_stay_removed_after_archive(self):
        old = {'market_metrics': [{'key': 'nfp', 'actual': '200K'}]}
        corrected = {'metric_contract_correction': {'removed_keys': ['nfp']},
                     'market_metrics': [{'key': 'veteran_unemployment', 'actual': '3.5%'}]}
        for first, second in [(old, corrected), (corrected, old)]:
            self.assertEqual([m['key'] for m in merge_observation(first, second)['market_metrics']], ['veteran_unemployment'])

    def test_duplicate_schedule_rows_merge_once(self):
        event = dict(country='US', title='Test', datetime_kst='2026-09-17T21:30+09:00', actual='196K')
        data = {'events': [event, {**event, 'actual': None}]}
        retain_calendar(data, {'events': []})
        self.assertEqual(len(data['events']), 1)
        self.assertEqual(data['events'][0]['actual'], '196K')

    def test_fed_unicode_and_missing_metric_are_recovered(self):
        statement = 'target range for the federal funds rate at 3‑1/2 to 3‑3/4 percent'
        self.assertEqual(fed_target_upper_from_statement(statement), 3.75)
        event = dict(country='US', title='FOMC 정책결정', datetime_kst='2026-06-18T03:00+09:00',
                     actual='3.75%', source_tier='OFFICIAL', market_metrics=[{'key': 'fed_rate', 'actual': None}])
        with patch('refresh_official_central_bank_actuals.fetch_text', return_value=statement):
            _, checks = apply_fomc_official_actual({'events': [event]}, datetime(2026, 9, 22, tzinfo=KST))
        self.assertTrue(checks)
        self.assertEqual(event['market_metrics'][0]['actual'], '3.75%')

    def test_api_requires_reference_period_not_release_month_guess(self):
        self.assertEqual(reference_month('November 2025'), (2025, 11))
        self.assertIsNone(reference_month(''))
        with patch('official_bls_api.fetch_series') as fetch:
            self.assertIsNone(collect_api({'title': 'Employment Situation'}, 'empsit', []))
            fetch.assert_not_called()

    def test_api_calculation_and_vintage_priority(self):
        from decimal import Decimal
        values = {(2025, 12): Decimal('150000'), (2026, 1): Decimal('150130')}
        self.assertEqual(calculate(values, 2026, 1, 1, 'K'), '130K')
        revised = {'actual': '140K', 'source_tier': 'OFFICIAL', 'value_vintage': 'LATEST_REVISION'}
        released = {'actual': '130K', 'source_tier': 'OFFICIAL', 'value_vintage': 'AS_RELEASED'}
        for a, b in [(released, revised), (revised, released)]:
            self.assertEqual(merge_observation(a, b)['actual'], '130K')

    def test_publish_concurrent_non_null_official_survives_local_null(self):
        event = dict(country='US', title='Release', importance=2, datetime_kst='2026-09-17T21:30+09:00')
        remote = {'events': [{**event, 'actual': '196K', 'source_tier': 'OFFICIAL'}]}
        local = {'events': [{**event, 'actual': None}]}
        merged = merge_generated('market-observatory/data/economic-calendar.json', local, remote)
        self.assertEqual(merged['events'][0]['actual'], '196K')
        self.assertEqual(merged['actual_freshness']['status'], 'LIVE')

    def test_every_calendar_publisher_shares_lock_and_pipeline(self):
        root = Path(__file__).resolve().parents[1]
        for name in ['economic-calendar-light-refresh', 'market-observatory-calendar-verified',
                     'market-observatory-calendar-capture', 'market-observatory-daily']:
            workflow = (root / '.github/workflows' / (name + '.yml')).read_text()
            self.assertIn('group: economic-calendar-canonical-writer', workflow)
            self.assertIn('tools/refresh_calendar_pipeline.py', workflow)
            self.assertIn('tools/publish_observatory_data.py', workflow)
            self.assertNotIn('git rebase -X theirs', workflow)

    def test_real_git_publication_retains_concurrent_release(self):
        import publish_observatory_data as publisher
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(cwd, *args):
                return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True)
            git(root, 'init', '--bare', 'origin.git')
            git(root, 'clone', str(root/'origin.git'), 'worker')
            worker = root/'worker'
            git(worker, 'checkout', '-b', 'main')
            for key, value in [('user.name', 'Test'), ('user.email', 'test@example.invalid')]:
                git(worker, 'config', key, value)
            path = 'market-observatory/data/economic-calendar.json'
            target = worker/path
            target.parent.mkdir(parents=True)
            event = dict(country='US', title='Release', importance=2,
                         datetime_kst='2026-09-17T21:30+09:00', actual=None)
            target.write_text(json.dumps({'events': [event]}))
            git(worker, 'add', '.'); git(worker, 'commit', '-m', 'base'); git(worker, 'push', '-u', 'origin', 'main')
            git(root, 'clone', '--branch', 'main', str(root/'origin.git'), 'other')
            other = root/'other'
            git(other, 'config', 'user.name', 'Test'); git(other, 'config', 'user.email', 'test@example.invalid')
            (other/path).write_text(json.dumps({'events': [{**event, 'actual': '196K', 'source_tier': 'OFFICIAL'}]}))
            git(other, 'add', '.'); git(other, 'commit', '-m', 'official release'); git(other, 'push')
            target.write_text(json.dumps({'events': [{**event, 'consensus': '207K'}]}))
            with patch.object(publisher, 'ROOT', worker):
                publisher.publish([path], 'local refresh')
            actual = json.loads(git(root, '--git-dir=origin.git', 'show', 'main:'+path).stdout)
            self.assertEqual(actual['events'][0]['actual'], '196K')
            self.assertEqual(actual['events'][0]['consensus'], '207K')
