import copy
import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import collect_fedwatch_official as official
import publish_observatory_data as publisher
from archive_fedwatch import archive_snapshot


class OfficialFedWatchTests(unittest.TestCase):
    def test_public_embed_remains_available_when_marketing_page_returns_403(self):
        from urllib.error import HTTPError
        from unittest.mock import MagicMock
        calls = []
        current = self.raw['current_html'] + "<form action='/User/QuikStrikeView.aspx?test=1'><input type='hidden' name='__VIEWSTATE' value='test'/><a href=\"javascript:__doPostBack('probabilities','')\">Probabilities</a></form>"
        payloads = iter(["<form action='?test=1'></form>", current, self.raw['matrix_html']])
        def request(req, timeout):
            calls.append(req)
            if req.full_url == official.PAGE:
                raise HTTPError(req.full_url, 403, 'Forbidden', {}, None)
            response = MagicMock()
            response.__enter__.return_value = response
            response.url = req.full_url
            response.read.return_value = next(payloads).encode()
            return response
        opener = MagicMock()
        opener.open.side_effect = request
        with patch.object(official.urllib.request, 'build_opener', return_value=opener):
            got = official.fetch_tables()
        self.assertEqual(got, (current, self.raw['matrix_html']))
        self.assertEqual(len(calls), 4)
        self.assertTrue(calls[1].full_url.startswith(official.HOST))
        self.assertEqual(calls[1].get_header('Referer'), official.PAGE)

    def test_rendered_uppercase_table_headers_are_accepted(self):
        raw = {**self.raw, 'current_html': self.raw['current_html'].replace('Target Rate (bps)', 'TARGET RATE (BPS)')}
        self.assertEqual(official.parse_tables(**raw, captured=self.now)['meeting_count'], 10)

    def setUp(self):
        self.raw = json.loads((ROOT / 'tests/fixtures/fedwatch-official-tables.json').read_text())
        self.now = datetime(2026, 10, 14, 8, 0, tzinfo=ZoneInfo('Asia/Seoul'))

    def snapshot(self):
        return official.parse_tables(**self.raw, captured=self.now)

    def test_published_values_timestamp_and_full_horizon_are_preserved(self):
        data = self.snapshot()
        self.assertEqual(data['source_as_of_ct_display'], '13 Oct 2026 05:50:31 CT')
        self.assertIsNone(data['source_as_of_kst'])
        self.assertEqual(data['meeting_count'], 10)
        self.assertEqual(data['hold_probability'], .773)
        self.assertEqual(data['hike_25bp_probability'], .227)
        april = data['meeting_probability_matrix'][4]
        self.assertEqual(april['published_probability_sum'], .999)
        self.assertEqual(april['probabilities']['4.50-4.75'], .358)
        self.assertEqual(data['meeting_probability_matrix'][-1]['meeting_date'], '2027-12-08')
        self.assertNotIn('5.50-5.75', data['meeting_probability_matrix'][0]['probabilities'])

    def test_missing_timestamp_changed_views_and_bad_sums_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'TIMESTAMP_MISSING'):
            official.parse_tables('', self.raw['matrix_html'], self.now)
        with self.assertRaises(ValueError):
            official.parse_tables(self.raw['current_html'], self.raw['matrix_html'].replace('77.3%', '90.3%', 1), self.now)
        with self.assertRaisesRegex(ValueError, 'FUTURE'):
            official.parse_tables(**self.raw, captured=datetime(2026,10,12,tzinfo=ZoneInfo('Asia/Seoul')))

    def test_current_day_uses_stored_file_without_network(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'official.json'
            path.write_text(json.dumps(self.snapshot()))
            with patch.object(official, 'fetch_tables', side_effect=AssertionError('unexpected fetch')):
                self.assertEqual(official.acquire(cache=path, now=self.now)['hike_25bp_probability'], .227)

    def test_old_fallback_cannot_replace_newer_official_snapshot(self):
        data = self.snapshot()
        fallback = {**copy.deepcopy(data), 'source_kind': 'SETTLEMENT_DERIVED',
                    'market_data_as_of': '2026-10-12', 'generated_kst': '2026-10-14T12:00:00+09:00'}
        for left, right in ((data, fallback), (fallback, data)):
            got = publisher.merge_generated('market-observatory/data/fed-watch.json', left, right)
            self.assertEqual(got['market_data_as_of'], '2026-10-13')
            self.assertEqual(got['source_kind'], official.SOURCE_KIND)

    def test_newer_fallback_does_not_replace_official_archive_selection(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = self.snapshot()
            (root / 'fed-watch.json').write_text(json.dumps(data))
            original = archive_snapshot(data, root)['entries'][0]['path']
            fallback = {**copy.deepcopy(data), 'source_kind': 'SETTLEMENT_DERIVED',
                        'generated_kst': '2026-10-14T12:00:00+09:00',
                        'meeting_probability_matrix': [data['meeting_probability_matrix'][0]]}
            index = archive_snapshot(fallback, root)
            self.assertEqual(index['entries'][0]['path'], original)
            self.assertEqual(len(index['entries'][0]['revisions']), 2)

    def test_rounded_official_rows_archive_with_raw_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = self.snapshot()
            (root / 'fed-watch.json').write_text(json.dumps(data))
            index = archive_snapshot(data, root)
            saved = json.loads((root / index['entries'][0]['path']).read_text())
            self.assertEqual(saved['official_evidence'], data['official_evidence'])
            data['meeting_probability_matrix'][0]['probabilities']['3.75-4.00'] = .9
            with self.assertRaises(ValueError):
                archive_snapshot(data, root)


if __name__ == '__main__':
    unittest.main()
