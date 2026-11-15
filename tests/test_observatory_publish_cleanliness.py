import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import publish_observatory_data as pub


class ObservatoryPublisherCleanlinessTest(unittest.TestCase):
    def test_market_source_always_publishes_atomic_health(self):
        source = 'market-observatory/data/observatory.json'
        audit = 'market-observatory/data/data-audit.json'
        status = 'market-observatory/data/freshness-status.json'
        # A crypto-only writer must not rely on a subsequent GitHub Actions
        # push trigger to update the published quote timestamps and verdict.
        self.assertEqual(pub.publication_paths([source]), [source, audit, status])
        self.assertEqual(pub.publication_paths([source, status]), [source, status, audit])
        self.assertEqual(len(pub.publication_paths([source, audit, status])), 3)
        # The canonical market consumers must be derived from the same source.
        bundle = pub.publication_paths(['public-market-daily.json'])
        self.assertTrue({source, audit, status, 'public-market-daily.json',
                         'market-observatory/data/daily-market-pulse.json'}.issubset(set(bundle)))

    def test_completed_market_source_and_glance_are_one_atomic_publication(self):
        expected=pub.DATA + 'daily-glance.json'
        for consumer in ('public-market-daily.json',pub.DATA+'daily-market-pulse.json'):
            paths=pub.publication_paths([consumer])
            self.assertIn(expected,paths,'dependent Glance absent from canonical commit')
            self.assertTrue(set(pub.MARKET_BUNDLE).issubset(paths))
            self.assertIn(pub.DATA+'data-audit.json',paths)
            self.assertIn(pub.DATA+'freshness-status.json',paths)
        # Independent BTC/ETH source-only refresh keeps its preexisting contract.
        self.assertNotIn(expected,pub.publication_paths([pub.DATA+'observatory.json']))

    def test_atomic_market_chain_rejects_stale_card_and_wrong_source(self):
        market={'us_completed_session_date':'2026-11-13',
                'generated_kst':'2026-11-14T21:23:56+09:00'}
        pulse={'market_date_us':'2026-11-13','snapshot_status':'FINAL',
               'generated_kst':'2026-11-14T21:24:38+09:00'}
        sidecar={'tripod_signal':{'date':'2026-11-13'}}
        card={'us_session':'2026-11-13','source_generated_kst':market['generated_kst'],
              'generated_kst':'2026-11-14T21:24:39+09:00',
              'consistency':{'status':'OK'},'no_trade':True,'read_only':True}
        pub.validate_market_bundle(market,pulse,sidecar,card)
        # This exact class caused the actual 11/15 editorial BLOCKED.
        stale=dict(card,generated_kst='2026-11-14T12:07:34+09:00')
        with self.assertRaisesRegex(RuntimeError,'clock_order'):
            pub.validate_market_bundle(market,pulse,sidecar,stale)
        wrong=dict(card,source_generated_kst='2026-11-14T12:07:34+09:00')
        with self.assertRaisesRegex(RuntimeError,'session_or_source_mismatch'):
            pub.validate_market_bundle(market,pulse,sidecar,wrong)
        mismatched=dict(pulse,market_date_us='2026-11-12')
        with self.assertRaisesRegex(RuntimeError,'session_or_source_mismatch'):
            pub.validate_market_bundle(market,mismatched,sidecar,card)
        pending=dict(pulse,snapshot_status='PROVISIONAL')
        with self.assertRaisesRegex(RuntimeError,'session_or_source_mismatch'):
            pub.validate_market_bundle(market,pending,sidecar,card)
        with self.assertRaisesRegex(RuntimeError,'naive_clock'):
            pub.validate_market_bundle(dict(market,generated_kst='2026-11-14T21:23:56'),
                                       pulse,sidecar,dict(card,source_generated_kst='2026-11-14T21:23:56'))
        with self.assertRaisesRegex(RuntimeError,'session_or_source_mismatch'):
            pub.validate_market_bundle(market,pulse,sidecar,dict(card,no_trade=False))

    def test_sector_source_publishes_atomic_json_and_markdown(self):
        source = pub.DATA + 'sector-etf.json'
        self.assertEqual(pub.publication_paths([source]), [
            source,
            pub.DATA + 'sector-rotation-brief.json',
            pub.DATA + 'sector-rotation-brief.md',
        ])
        with self.assertRaisesRegex(ValueError, 'DATA_PUBLISHER_REJECTED_NON_DATA_PATH'):
            pub.publication_paths([pub.DATA + 'unrelated.md'])

    def test_calendar_only_does_not_claim_unrelated_market_health(self):
        calendar = 'market-observatory/data/economic-calendar.json'
        self.assertEqual(pub.publication_paths([calendar]), [calendar])

    def test_unselected_generated_json_is_restored_before_rebase(self):
        calls=[]
        old=pub.git
        def fake_git(*args,check=True):
            calls.append(args)
            if args[:2]==('status','--porcelain=v1'):
                return SimpleNamespace(stdout=' M market-observatory/data/economic-calendar-history.json\n',stderr='',returncode=0)
            return SimpleNamespace(stdout='',stderr='',returncode=0)
        try:
            pub.git=fake_git
            discarded=pub.clean_unselected_generated(['market-observatory/data/observatory.json'])
        finally:
            pub.git=old
        self.assertEqual(discarded,['market-observatory/data/economic-calendar-history.json'])
        self.assertIn(('restore','--worktree','--','market-observatory/data/economic-calendar-history.json'),calls)

    def test_python_cache_artifacts_are_disposable(self):
        old=pub.git
        def fake_git(*args,check=True):
            if args[:2]==('status','--porcelain=v1'):
                return SimpleNamespace(
                    stdout='?? tests/__pycache__/test_x.cpython-312.pyc\n?? tools/__pycache__/x.cpython-312.pyc\n',
                    stderr='',returncode=0)
            return SimpleNamespace(stdout='',stderr='',returncode=0)
        try:
            pub.git=fake_git
            discarded=pub.clean_unselected_generated(['market-observatory/data/observatory.json'])
        finally:
            pub.git=old
        self.assertEqual(len(discarded),2)
        self.assertTrue(all(pub.is_ephemeral_build_artifact(x) for x in discarded))

    def test_non_generated_dirty_file_still_fails_closed(self):
        old=pub.git
        def fake_git(*args,check=True):
            if args[:2]==('status','--porcelain=v1'):
                return SimpleNamespace(stdout=' M market-observatory/index.html\n',stderr='',returncode=0)
            return SimpleNamespace(stdout='',stderr='',returncode=0)
        try:
            pub.git=fake_git
            with self.assertRaisesRegex(RuntimeError,'index.html'):
                pub.clean_unselected_generated(['market-observatory/data/observatory.json'])
        finally:
            pub.git=old

    def test_selected_dirty_payload_is_not_silently_discarded(self):
        old=pub.git
        def fake_git(*args,check=True):
            if args[:2]==('status','--porcelain=v1'):
                return SimpleNamespace(stdout=' M market-observatory/data/observatory.json\n',stderr='',returncode=0)
            return SimpleNamespace(stdout='',stderr='',returncode=0)
        try:
            pub.git=fake_git
            with self.assertRaisesRegex(RuntimeError,'observatory.json'):
                pub.clean_unselected_generated(['market-observatory/data/observatory.json'])
        finally:
            pub.git=old


if __name__=='__main__':
    unittest.main()


class CanonicalCalendarSerializationTest(__import__('unittest').TestCase):
    def test_calendar_files_ignore_key_order_but_keep_arrays(self):
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
        from publish_observatory_data import serialize
        a = {'series': {'x': {'rows': [{'date': '1', 'source_tier': 'OFFICIAL', 'value_vintage': 'AS_RELEASED'},
                                       {'date': '2'}]}}, 'schema': 'S'}
        b = {'schema': 'S', 'series': {'x': {'rows': [{'value_vintage': 'AS_RELEASED', 'date': '1', 'source_tier': 'OFFICIAL'},
                                                      {'date': '2'}]}}}
        for path in ('market-observatory/data/economic-calendar-history.json', 'market-observatory/data/economic-calendar.json'):
            self.assertEqual(serialize(path, a), serialize(path, b))
        self.assertLess(serialize('market-observatory/data/economic-calendar.json', a).index('"1"'),
                        serialize('market-observatory/data/economic-calendar.json', a).index('"2"'))
        # Other files keep writer order.
        self.assertNotEqual(serialize('market-observatory/data/observatory.json', a),
                            serialize('market-observatory/data/observatory.json', b))
