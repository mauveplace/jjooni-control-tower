import re
import textwrap
import unittest
from pathlib import Path
from tools.observatory_ui_assets import ensure_runtime, require_runtime


class RuntimeVersions(unittest.TestCase):
    def test_scheduled_installer_preserves_newer_cache_key(self):
        html = '<body><script src="./freshness-watchdog-v1.js?v=20261018-ui1"></script></body>'
        self.assertEqual(ensure_runtime(html, 'freshness-watchdog-v1.js', '1.3'), html)

    def test_missing_or_unversioned_runtime_is_installed_once(self):
        for html in ['<body></body>', '<body><script src="./freshness-watchdog-v1.js"></script></body>']:
            result = ensure_runtime(html, 'freshness-watchdog-v1.js', '1.3')
            require_runtime(result, 'freshness-watchdog-v1.js')
            self.assertEqual(result.count('freshness-watchdog-v1.js'), 1)

    def test_duplicate_runtime_is_rejected(self):
        html = '<script src="./x.js?v=1"></script>' * 2
        with self.assertRaises(ValueError):
            ensure_runtime(html, 'x.js', '2')

    def test_checked_in_board_cache_key_matches_production_publication_contract(self):
        # This mismatch previously let UI tests pass but blocked every daily publish.
        html = Path('market-observatory/index.html').read_text()
        board = Path('market-observatory/latest-board-v1.js').read_text()
        url = re.search(r'latest-board-v1\\.js\\?v=([^"&]+)', html)
        runtime = re.search(r"version:'([^']+)'", board)
        self.assertIsNotNone(url)
        self.assertIsNotNone(runtime)
        self.assertEqual(url[1], runtime[1], 'Board cache key blocks daily data publication')

    def test_actual_sector_acceptance_accepts_current_ui_release(self):
        # Execute the real workflow contract, including all dataset checks.
        yaml = Path('.github/workflows/market-observatory-sector-qa.yml').read_text()
        block = re.findall(r"python - <<'PY'\n(.*?)\n          PY", yaml, re.S)[-1]
        exec(compile(textwrap.dedent(block), 'sector-acceptance', 'exec'), {})


if __name__ == '__main__':
    unittest.main()
