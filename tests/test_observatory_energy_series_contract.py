"""Prevent dashboard commodity tiles with no backing market-data collector."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ObservatoryEnergySeriesContract(unittest.TestCase):
    def test_commodity_cards_are_in_at_least_one_collector(self):
        board = (ROOT / 'market-observatory/latest-board-v1.js').read_text(encoding='utf-8')
        daily = (ROOT / 'tools/build_market_observatory.py').read_text(encoding='utf-8')
        supplemental = (ROOT / 'tools/refresh_observatory_supplementals.py').read_text(encoding='utf-8')
        patterns = (
            r"\{key:'commodity',label:'원자재',keys:\[([^\]]+)\]\}",
            r"energy:\{title:'원자재 주요 지표'[^\n]*keys:\[([^\]]+)\]\}",
        )
        for pattern in patterns:
            found = re.search(pattern, board)
            self.assertIsNotNone(found, pattern)
            keys = re.findall(r"'([A-Z]+)'", found.group(1))
            self.assertTrue(keys)
            for key in keys:
                self.assertTrue(f"'{key}':" in daily or f"'{key}':" in supplemental,
                                f"{key} has a visible card but no underlying collector")

    def test_gasoline_is_not_an_orphan_optional_data_source(self):
        for path in (
            'market-observatory/latest-board-v1.js',
            'tools/build_market_observatory.py',
            'tools/refresh_observatory_supplementals.py',
            'tools/audit_observatory_data.py',
        ):
            contents = (ROOT / path).read_text(encoding='utf-8')
            self.assertNotIn('GASOLINE', contents, path)
            self.assertNotIn('RB=F', contents, path)

    def test_board_asset_is_single_valid_versioned_module(self):
        board = (ROOT / 'market-observatory/latest-board-v1.js').read_text(encoding='utf-8')
        html = (ROOT / 'market-observatory/index.html').read_text(encoding='utf-8')
        self.assertTrue(board.startswith('(()=>{\n'), 'Board module must start with one IIFE')
        self.assertEqual(board.count('\n})();'), 1)
        runtime = re.search(r"__JJOONI_LATEST_BOARD=\{version:'([^']+)'", board)
        cache = re.search(r"latest-board-v1[.]js[?]v=([^&\"]+)", html)
        self.assertIsNotNone(runtime)
        self.assertIsNotNone(cache)
        self.assertEqual(runtime.group(1), cache.group(1))


if __name__ == '__main__':
    unittest.main()
