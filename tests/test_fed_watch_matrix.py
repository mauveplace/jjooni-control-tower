import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import build_fed_watch_v2 as fw


class FedWatchMatrixTests(unittest.TestCase):
    def test_conditional_convolution_matches_three_node_shape(self):
        state = {0: 0.828, 1: 0.172}
        local = [
            {"move_count_25bp": 0, "probability": 0.1908},
            {"move_count_25bp": 1, "probability": 0.8092},
        ]
        out = fw.convolve_move_distribution(state, local)
        self.assertAlmostEqual(sum(out.values()), 1.0, places=9)
        self.assertAlmostEqual(out[0], 0.1579824, places=7)
        self.assertAlmostEqual(out[2], 0.1391824, places=7)
        self.assertAlmostEqual(out[1], 1.0 - out[0] - out[2], places=7)

    def test_negative_and_positive_nodes_remain_normalized(self):
        state = {-1: 0.25, 0: 0.75}
        local = [
            {"move_count_25bp": 0, "probability": 0.6},
            {"move_count_25bp": 1, "probability": 0.4},
        ]
        out = fw.convolve_move_distribution(state, local)
        self.assertAlmostEqual(sum(out.values()), 1.0, places=9)
        self.assertEqual(set(out), {-1, 0, 1})

    def test_target_ranges_follow_25bp_nodes(self):
        self.assertEqual(fw._target_label_for_move(0, 3.75, 4.00), "3.75-4.00")
        self.assertEqual(fw._target_label_for_move(1, 3.75, 4.00), "4.00-4.25")
        self.assertEqual(fw._target_label_for_move(-1, 3.75, 4.00), "3.50-3.75")

    def test_business_gap_ignores_weekends(self):
        from datetime import date
        self.assertEqual(fw._business_gap(date(2026, 10, 5), date(2026, 10, 2)), 1)
        self.assertEqual(fw._business_gap(date(2026, 10, 6), date(2026, 10, 2)), 2)


if __name__ == "__main__":
    unittest.main()
