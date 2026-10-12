import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import publish_observatory_data as pub


class ObservatoryPublisherCleanlinessTest(unittest.TestCase):
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
