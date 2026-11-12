import pathlib
import sys
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'tools'))
from check_morning_publication import decide  # noqa: E402

KST = ZoneInfo('Asia/Seoul')


class MorningPublication(unittest.TestCase):
    def test_2026_11_12_incident_fails(self):
        now = datetime(2026, 11, 12, 7, 7, tzinfo=KST)  # Thursday
        p = decide(now, {'report_date_kst': '2026-11-11'}, {'us_completed_session_date': '2026-11-10'})
        self.assertTrue(any(x.startswith('BRIEF_MISSING') for x in p))
        self.assertTrue(any(x.startswith('US_CLOSE_STALE') for x in p))

    def test_healthy_morning_passes(self):
        now = datetime(2026, 11, 12, 7, 7, tzinfo=KST)
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-12'}, {'us_completed_session_date': '2026-11-11'}), [])

    def test_before_deadline_only_checks_data(self):
        now = datetime(2026, 11, 12, 6, 40, tzinfo=KST)
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-11'}, {'us_completed_session_date': '2026-11-11'}), [])

    def test_monday_brief_not_checked(self):
        now = datetime(2026, 11, 16, 7, 7, tzinfo=KST)  # Monday: separate edition
        p = decide(now, {'report_date_kst': '2026-11-15'}, {'us_completed_session_date': '2026-11-13'})
        self.assertEqual(p, [])


if __name__ == '__main__':
    unittest.main()
