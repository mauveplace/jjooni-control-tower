import sys
import unittest
from pathlib import Path

# Keep this test independent from test-discovery order and unrelated imports.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from write_observatory_watchdog_status import publication_latency

class PublicationLatencyTests(unittest.TestCase):
    def test_regular_est_close(self):
        self.assertEqual(publication_latency("2026-11-12","2026-11-13T07:36:46+09:00"),96.8)
    def test_summer_dst(self):
        self.assertEqual(publication_latency("2026-07-06","2026-07-07T05:30:00+09:00"),30.0)
    def test_early_close(self):
        self.assertEqual(publication_latency("2026-11-27","2026-11-28T04:00:00+09:00"),60.0)
    def test_missing_or_unzoned(self):
        self.assertIsNone(publication_latency(None,None))
        self.assertIsNone(publication_latency("2026-11-12","2026-11-13T07:36:46"))
if __name__=="__main__": unittest.main()
