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

    def test_sunday_2026_11_15_does_not_raise_phantom_report(self):
        # Real failed GH runs 43664629385 and 43668199572 demanded Sunday
        # publication even though Friday Nov 13 was the latest US session.
        now = datetime(2026, 11, 15, 11, 31, tzinfo=KST)
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-14'},
                                {'us_completed_session_date': '2026-11-13'}), [])

    def test_friday_2026_11_13_is_a_real_missing_report(self):
        # Real failed GH runs 43352923596 and 43358444013.
        now = datetime(2026, 11, 13, 11, 33, tzinfo=KST)
        issues = decide(now, {'report_date_kst': '2026-11-12'},
                             {'us_completed_session_date': '2026-11-12'})
        self.assertEqual(issues, ['BRIEF_MISSING expected=2026-11-13 latest=2026-11-12'])

    def test_full_nyse_holiday_thanksgiving_is_not_missed_report(self):
        # Thu Nov 26 (ET) is closed; no Fri Nov 27 (KST) fresh US edition.
        now = datetime(2026, 11, 27, 7, 7, tzinfo=KST)
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-26'},
                                {'us_completed_session_date': '2026-11-25'}), [])

    def test_nyse_early_close_does_require_saturday_brief(self):
        # Fri Nov 27 (ET) 13:00 early-close is still a completed session.
        now = datetime(2026, 11, 28, 7, 7, tzinfo=KST)
        issues = decide(now, {'report_date_kst': '2026-11-26'},
                             {'us_completed_session_date': '2026-11-27'})
        self.assertTrue(any(x.startswith('BRIEF_MISSING expected=2026-11-28') for x in issues))

    def test_monday_separate_edition_still_not_checked(self):
        now = datetime(2026, 11, 16, 7, 7, tzinfo=KST)
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-14'},
                                {'us_completed_session_date': '2026-11-13'}), [])

    def test_monday_brief_not_checked(self):
        now = datetime(2026, 11, 16, 7, 7, tzinfo=KST)  # Monday: separate edition
        p = decide(now, {'report_date_kst': '2026-11-15'}, {'us_completed_session_date': '2026-11-13'})
        self.assertEqual(p, [])


if __name__ == '__main__':
    unittest.main()
