"""Contract: BTC/ETH producer atomically publishes the matching 30-second card.

A branch merge starts independent writers simultaneously; a card built before
Binance has published can otherwise pin an older CoinGecko-only observation
throughout the trading day despite fresh canonical data.
"""
import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from tests.test_daily_glance import observatory

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import build_daily_glance as glance
import publish_observatory_data as publisher


class CryptoGlanceAtomicContract(unittest.TestCase):
    def test_workflow_publishes_crypto_and_glance_in_same_committed_bundle(self):
        text=(ROOT/'.github/workflows/observatory-crypto-refresh.yml').read_text()
        collect=text.index("id: collect")
        rebuild=text.index("id: glance")
        publication=text.index("Publish crypto and matching card in one atomic commit")
        self.assertLess(collect,rebuild)
        self.assertLess(rebuild,publication)
        self.assertIn("run: python tools/build_daily_glance.py",text)
        self.assertIn("files+=(market-observatory/data/daily-glance.json)",text)
        self.assertIn('"${files[@]}"',text)
        self.assertIn('if [ "$GLANCE_OUTCOME" = success ]',text)
        self.assertIn('steps.collect.outcome',text)
        self.assertIn('continue-on-error: true',text)
        self.assertIn("ref: main",text)

    def test_atomic_bundle_includes_health_and_canonical(self):
        paths=publisher.publication_paths([
            "market-observatory/data/observatory.json",
            "market-observatory/data/daily-glance.json"
        ])
        self.assertEqual(len(paths),len(set(paths)))
        for key in ("market-observatory/data/observatory.json",
                    "market-observatory/data/daily-glance.json",
                    "market-observatory/data/freshness-status.json",
                    "market-observatory/data/data-audit.json"):
            self.assertIn(key,paths)

    def test_source_publication_rebuilds_glance_after_merge_and_leaves_identical_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / publisher.MARKET_BUNDLE[0]
            source.parent.mkdir(parents=True)
            card = root / publisher.GLANCE
            paths = [publisher.MARKET_BUNDLE[0]]
            first = '2026-11-10T13:46:47+09:00'
            newer = '2026-11-10T21:02:47+09:00'
            with patch.object(publisher, 'ROOT', root), \
                 patch.object(publisher, 'materialize_market_dependents'), \
                 patch.object(publisher, 'materialize', return_value=[]), \
                 patch.object(publisher, 'materialize_health'):
                for timestamp in (first, newer):
                    source.write_text(json.dumps(observatory(generated_kst=timestamp)))
                    self.assertIn(publisher.GLANCE, publisher.materialize_publication(paths))
                    self.assertEqual(json.loads(card.read_text())['source_generated_kst'], timestamp)
                original = card.read_bytes()
                self.assertNotIn(publisher.GLANCE, publisher.materialize_publication(paths))
                self.assertEqual(card.read_bytes(), original)

                source.write_text(json.dumps(observatory(series={'NASDAQ100': [None]})))
                self.assertEqual(publisher.materialize_publication(paths), paths)
                self.assertEqual(card.read_bytes(), original)

    def test_card_only_rebuilds_and_unrelated_publications_leave_card_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / publisher.MARKET_BUNDLE[0]
            source.parent.mkdir(parents=True)
            source.write_text(json.dumps(observatory()))
            with patch.object(publisher, 'ROOT', root):
                self.assertFalse(publisher.materialize_daily_glance(
                    [publisher.DATA + 'economic-calendar.json']))
                self.assertFalse((root / publisher.GLANCE).exists())
                self.assertTrue(publisher.materialize_daily_glance([publisher.GLANCE]))

    def test_concurrent_card_merge_prefers_source_time_over_build_time(self):
        older = {'source_generated_kst': '2026-11-10T13:46:47+09:00',
                 'generated_kst': '2026-11-10T22:00:00+09:00'}
        newer = {'source_generated_kst': '2026-11-10T21:02:47+09:00',
                 'generated_kst': '2026-11-10T21:03:00+09:00'}
        self.assertEqual(publisher.merge_generated(publisher.GLANCE, older, newer), newer)
        self.assertEqual(publisher.merge_generated(publisher.GLANCE, newer, older), newer)

    def test_just_collected_live_quote_is_used_with_native_usdt_reference(self):
        today=date(2026,11,10)
        yesterday=(today-timedelta(days=1)).isoformat()
        observations=[
            {"date":yesterday,"value":74400,"session_status":"COMPLETED","quote_currency":"USD"},
            {"date":today.isoformat(),"value":75000,"session_status":"IN_PROGRESS","quote_currency":"USDT"}
        ]
        quote={"status":"LIVE","source":"Binance Spot last trade / USDT","quote_currency":"USDT",
               "quote_as_of_kst":"2026-11-10T12:45:00+09:00",
               "price":75000,"daily_change_safe":True,
               "previous_close_currency":"USDT",
               "previous_close_value":74800,
               "previous_close_utc_date":yesterday}
        item=glance.metric("BTCUSD","비트코인",observations,quote)
        self.assertEqual(item["date"],today.isoformat())
        self.assertEqual(item["quote_currency"],"USDT")
        self.assertEqual(item["source"],quote["source"])
        self.assertAlmostEqual(item["d1_pct"],round((75000/74800-1)*100,2))
        self.assertEqual(observations[0]["value"],74400)

    def test_failed_glance_uses_source_only_and_preserves_failure_visibility(self):
        text=(ROOT/'.github/workflows/observatory-crypto-refresh.yml').read_text()
        publish=text.split("Publish crypto and matching card in one atomic commit",1)[1]
        self.assertIn('files=(market-observatory/data/observatory.json)',publish)
        self.assertIn('::warning title=Daily Glance unavailable::',publish)
        self.assertIn('test "$COLLECTION_OUTCOME" = success',publish)


if __name__=='__main__':
    unittest.main()
