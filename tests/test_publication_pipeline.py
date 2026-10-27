import hashlib
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import publish_observatory_data as pub
from observatory_history_views import encoded
from build_daily_market_pulse import cached_concentration


class PublicationPipelineTest(unittest.TestCase):
    def test_enrichment_reuse_keeps_original_clock_and_never_relabels_stale_as_live(self):
        now = datetime.now(timezone.utc)
        fresh = {'status': 'LIVE', 'observed_at_kst': (now-timedelta(hours=1)).isoformat(), 'top10_weight_pct': 50}
        previous = {'raw': {'nasdaq100_concentration': fresh}}
        self.assertEqual(cached_concentration(previous, now), fresh)
        self.assertEqual(cached_concentration(previous, now+timedelta(days=1))['status'], 'STALE_FALLBACK')
        self.assertEqual(previous['raw']['nasdaq100_concentration']['status'], 'LIVE')
        del fresh['observed_at_kst']
        self.assertEqual(cached_concentration(previous, now)['status'], 'STALE_FALLBACK')

    def test_daily_consumer_closes_market_group_but_crypto_remains_independent(self):
        health = {pub.DATA + 'data-audit.json', pub.DATA + 'freshness-status.json'}
        for consumer in pub.MARKET_BUNDLE[1:]:
            self.assertEqual(set(pub.publication_paths([consumer])), set(pub.MARKET_BUNDLE) | health)
        self.assertEqual(set(pub.publication_paths([pub.MARKET_BUNDLE[0]])),
                         {pub.MARKET_BUNDLE[0]} | health)

    def test_data_publisher_refuses_ui_source_and_path_traversal(self):
        for path in ['market-observatory/index.html','index.html','market-observatory/sector-etf-v1.js','market-observatory/data/../index.json']:
            with self.assertRaisesRegex(ValueError,'DATA_PUBLISHER_REJECTED_NON_DATA_PATH'):
                pub.publication_paths([path])
        self.assertEqual(pub.publication_paths(['market-observatory/data/observatory.json']),
                         ['market-observatory/data/observatory.json',
                          'market-observatory/data/data-audit.json',
                          'market-observatory/data/freshness-status.json'])

    def test_archive_records_the_derived_snapshot_not_the_input_placeholder(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / pub.DATA
            data.mkdir(parents=True)
            pulse = data / 'daily-market-pulse.json'
            pulse.write_text('{}')
            expected = {'market_date_us': '2026-10-16', 'generated_kst': '2026-10-17T06:00:00+09:00',
                        'raw': {'ndx': 29187.55}, 'quality': {'status': 'LIVE'}}
            def derive(_paths):
                pulse.write_text(json.dumps(expected))
                (data / 'observatory.json').write_text(json.dumps({'series':{'NASDAQ100':[{'date':'2026-10-16','value':29187.55}]},'latest':{'NASDAQ100':29187.55}}))
            with patch.object(pub, 'ROOT', root), patch.object(pub, 'materialize_market_dependents', derive), \
                    patch.object(pub, 'materialize_health'):
                paths = pub.materialize_publication(list(pub.MARKET_BUNDLE))
            reader=json.loads((data/'observatory-recent.json').read_text())
            self.assertEqual(reader['latest']['NASDAQ100'],29187.55)
            archive = {**expected, 'archive_contract': 'IMMUTABLE_FACTS_AND_RULES_NOT_AI_COMMENTARY_V1'}
            digest = hashlib.sha256(encoded(archive)).hexdigest()
            relative = pub.DATA + f'pulse-history/observations/{digest}.json'
            self.assertIn(relative, paths)
            self.assertEqual(json.loads((root / relative).read_text()), archive)
            index = json.loads((data / 'pulse-history/index.json').read_text())
            self.assertEqual(index['observations'][0]['snapshot_id'], digest)

    def test_all_publication_passes_share_derive_archive_health_order(self):
        calls = []
        with patch.object(pub, 'materialize_market_dependents', side_effect=lambda _: calls.append('derive')), \
                patch.object(pub, 'materialize', side_effect=lambda *_: calls.append('archive') or []), \
                patch.object(pub, 'materialize_health', side_effect=lambda _: calls.append('health')):
            pub.materialize_publication([])
        self.assertEqual(calls, ['derive', 'archive', 'health'])


if __name__ == '__main__':
    unittest.main()
