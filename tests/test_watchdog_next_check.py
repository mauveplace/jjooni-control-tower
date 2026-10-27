import sys
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from write_observatory_watchdog_status import next_check_due

class WatchdogNextCheckTest(unittest.TestCase):
    def test_morning_record_does_not_expire_during_same_afternoon(self):
        due=next_check_due(datetime.fromisoformat('2026-10-27T07:28:00+09:00'))
        self.assertEqual(due,'2026-10-28T08:10:00+09:00')

    def test_utc_saturday_is_skipped_and_sunday_candidate_is_preserved(self):
        due=next_check_due(datetime.fromisoformat('2026-10-24T07:28:00+09:00'))
        self.assertEqual(due,'2026-10-26T08:10:00+09:00')

    def test_in_window_record_follows_the_next_exact_cron_candidate(self):
        due=next_check_due(datetime.fromisoformat('2026-10-27T05:11:00+09:00'))
        self.assertEqual(due,'2026-10-27T08:20:00+09:00')
