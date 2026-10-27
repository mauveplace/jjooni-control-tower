import copy
import hashlib
import json
import sys
import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import publish_observatory_data as pub
import build_public_market_daily as public
import build_daily_market_pulse as pulse
from observatory_history_views import encoded


def observation():
    end = datetime.now(public.KST).date() - timedelta(days=1)
    dates = [(end - timedelta(days=n)).isoformat() for n in range(399, -1, -1)]
    series = {k: [{'date': d, 'value': (20000 + i if k == 'NASDAQ100' else 20.0)}
                  for i, d in enumerate(dates)] for k in ('NASDAQ100', 'SP500', 'VIX', 'DXY', 'USDKRW', 'US10Y_OFFICIAL', 'FEAR_GREED')}
    return {'us_completed_session_date': dates[-1], 'generated_kst': '2026-10-14T04:00:00+09:00', 'series': series}


class AtomicSessionTest(unittest.TestCase):
    def test_newer_session_survives_older_generation_clock(self):
        new = observation()
        old = copy.deepcopy(new)
        old['us_completed_session_date'] = new['series']['NASDAQ100'][-2]['date']
        old['generated_kst'] = '2026-10-14T06:00:00+09:00'
        merged = pub.merge_generated(pub.DATA + 'observatory.json', new, old)
        self.assertEqual(merged['us_completed_session_date'], new['us_completed_session_date'])

    def test_consumers_rebuild_from_same_snapshot_without_network(self):
        obs = observation()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / pub.DATA
            data.mkdir(parents=True)
            (data / 'observatory.json').write_text(json.dumps(obs))
            with patch.object(pub, 'ROOT', root), patch.object(public, 'OUT'), \
                 patch.object(pulse, 'DATA'), patch.object(pulse, 'OUT'), \
                 patch.object(public, 'get_json', side_effect=AssertionError('unexpected network')), \
                 patch.object(pulse, 'fetch_text', side_effect=AssertionError('unexpected network')):
                pub.materialize_market_dependents([pub.DATA + 'observatory.json', pub.DATA + 'daily-market-pulse.json', 'public-market-daily.json'])
                sidecar = json.loads((root / 'public-market-daily.json').read_text())
                report = json.loads((data / 'daily-market-pulse.json').read_text())
                rebuilt = json.loads((data / 'observatory.json').read_text())
            self.assertEqual(sidecar['tripod_signal']['session_date'], obs['us_completed_session_date'])
            self.assertEqual(report['market_date_us'], obs['us_completed_session_date'])
            self.assertEqual(rebuilt['tripod_latest']['session_date'], obs['us_completed_session_date'])
            self.assertEqual(rebuilt['tripod_history'][-1]['date'], obs['us_completed_session_date'])
            self.assertEqual(report['raw']['tradingview_cross_asset']['usdkrw']['market_date'], obs['us_completed_session_date'])
            self.assertEqual(sidecar['market_context']['items']['USDKRW']['value'], obs['series']['USDKRW'][-1]['value'])

    def test_real_git_rebase_keeps_newest_session_and_rebuilds_consumers(self):
        def git(root, *args):
            return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True, text=True).stdout.strip()
        def write(root, obs):
            data = root / pub.DATA
            data.mkdir(parents=True, exist_ok=True)
            (data / 'observatory.json').write_text(json.dumps(obs))
            (data / 'daily-market-pulse.json').write_text('{}')
            (root / 'public-market-daily.json').write_text('{}')
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp)
            bare = parent / 'remote.git'
            subprocess.run(['git', 'init', '--bare', str(bare)], check=True, capture_output=True)
            remote = parent / 'producer'
            local = parent / 'repair'
            subprocess.run(['git', 'clone', str(bare), str(remote)], check=True, capture_output=True)
            git(remote, 'config', 'user.name', 'Test')
            git(remote, 'config', 'user.email', 'test@example.test')
            git(remote, 'checkout', '-b', 'main')
            old = observation()
            write(remote, old)
            git(remote, 'add', '.')
            git(remote, 'commit', '-m', 'base')
            git(remote, 'push', 'origin', 'main')
            subprocess.run(['git', 'clone', '-b', 'main', str(bare), str(local)], check=True, capture_output=True)
            git(local, 'config', 'user.name', 'Test')
            git(local, 'config', 'user.email', 'test@example.test')
            newer = copy.deepcopy(old)
            newer['generated_kst'] = '2026-10-14T06:00:00+09:00'
            write(remote, newer)
            git(remote, 'add', '.')
            git(remote, 'commit', '-m', 'concurrent producer')
            git(remote, 'push', 'origin', 'main')
            paths = [pub.DATA + 'observatory.json', pub.DATA + 'daily-market-pulse.json', 'public-market-daily.json']
            # This temporary Git fixture has no tools/ tree. Stub only the
            # audit builder; the actual publication/rebase and its health-file
            # inclusion remain exercised against a real local Git remote.
            health = [pub.DATA + 'data-audit.json', pub.DATA + 'freshness-status.json']
            def derive_test_health(selected):
                if not set(health).issubset(set(selected)):
                    return
                source = json.loads((local / paths[0]).read_text())
                for rel in health:
                    (local / rel).write_text(json.dumps({'source_generated_kst': source['generated_kst']}))
            with patch.object(pub, 'ROOT', local), patch.object(public, 'OUT'), \
                 patch.object(pulse, 'DATA'), patch.object(pulse, 'OUT'), \
                 patch.object(pub, 'materialize_health', side_effect=derive_test_health):
                pub.publish(paths, 'repair market sources and consumers')
            for rel in health:
                self.assertEqual(json.loads((local / rel).read_text())['source_generated_kst'], newer['generated_kst'])
            obs = json.loads((local / paths[0]).read_text())
            report = json.loads((local / paths[1]).read_text())
            sidecar = json.loads((local / paths[2]).read_text())
            self.assertEqual(obs['generated_kst'], newer['generated_kst'])
            self.assertEqual(obs['tripod_latest']['session_date'], report['market_date_us'])
            self.assertEqual(sidecar['tripod_signal']['session_date'], report['market_date_us'])
            archived = {k: v for k, v in report.items() if k != 'history'}
            archived['archive_contract'] = 'IMMUTABLE_FACTS_AND_RULES_NOT_AI_COMMENTARY_V1'
            digest = hashlib.sha256(encoded(archived)).hexdigest()
            stored = local / pub.DATA / 'pulse-history/observations' / (digest + '.json')
            self.assertTrue(stored.is_file(), 'post-rebase archive must match the exact published pulse')
            self.assertEqual(json.loads(stored.read_text()), archived)
            index = json.loads((local / pub.DATA / 'pulse-history/index.json').read_text())
            self.assertIn(digest, [r['snapshot_id'] for r in index['observations']])
            self.assertEqual(git(local, 'status', '--porcelain'), '')

    def test_incomplete_new_session_cannot_be_mislabeled(self):
        obs = observation()
        obs['series']['VIX'].pop()
        with self.assertRaisesRegex(RuntimeError, 'CANONICAL_SESSION_MISMATCH'):
            public.build_tripod(obs)


if __name__ == '__main__':
    unittest.main()
