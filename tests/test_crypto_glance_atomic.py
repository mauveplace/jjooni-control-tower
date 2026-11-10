"""Contract: BTC/ETH producer atomically publishes the matching 30-second card.

A branch merge starts independent writers simultaneously; a card built before
Binance has published can otherwise pin an older CoinGecko-only observation
throughout the trading day despite fresh canonical data.
"""
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

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

    def test_rebuild_glance_after_every_source_rebase(self):
        # The publisher runs materialize_publication before the initial
        # commit AND again after rebasing over concurrent crypto/day writers.
        # Do not rely on later generated_kst from an earlier source checkout.
        paths=["market-observatory/data/daily-glance.json"]
        with patch.object(publisher,"materialize_market_dependents") as market, \
             patch.object(publisher,"materialize",return_value=[]) as materialize, \
             patch.object(publisher,"materialize_health") as health, \
             patch.object(glance,"main",return_value=0) as regenerate:
            result=publisher.materialize_publication(paths)
            self.assertEqual(result,paths)
            publisher.materialize_publication(paths)
        self.assertEqual(regenerate.call_count,2)
        self.assertEqual(market.call_count,2)
        self.assertEqual(health.call_count,2)

    def test_non_glance_publication_does_not_add_implicit_card_rebuild(self):
        with patch.object(publisher,"materialize_market_dependents"), \
             patch.object(publisher,"materialize",return_value=[]), \
             patch.object(publisher,"materialize_health"), \
             patch.object(glance,"main") as rebuild:
            publisher.materialize_publication(["market-observatory/data/observatory.json"])
        rebuild.assert_not_called()

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
