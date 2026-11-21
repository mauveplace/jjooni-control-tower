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
        self.assertEqual(decide(now, {'report_date_kst': '2026-11-12', 'market_date_us': '2026-11-11'}, {'us_completed_session_date': '2026-11-11'}), [])

    def test_before_deadline_only_checks_data(self):
        now = datetime(2026, 11, 12, 6, 20, tzinfo=KST)
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

    def test_watchdog_schedule_and_issue_recovery_contract(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        workflow = (root / '.github/workflows/morning-publication-watchdog.yml').read_text(encoding='utf-8')
        self.assertIn("cron: '7,37 22 * * 1-5'", workflow)
        self.assertIn("cron: '7 23 * * 1-5'", workflow)
        self.assertNotIn("cron: '7,37 22 * * 1-6'", workflow)
        self.assertIn('github.event.schedule == \'7 23 * * 1-5\'', workflow)
        self.assertIn('MORNING_PUBLICATION=FAIL BRIEF_MISSING', workflow)
        self.assertIn('gh issue list --repo', workflow)
        self.assertIn('gh issue create --repo', workflow)
        self.assertIn('MORNING_BRIEF_INCIDENT=ALREADY_TRACKED', workflow)

    def test_at_0630_deadline_report_is_already_required(self):
        now = datetime(2026, 11, 21, 6, 30, tzinfo=KST)
        issues = decide(now, {'report_date_kst': '2026-11-20'},
                        {'us_completed_session_date': '2026-11-19'})
        self.assertTrue(any(x.startswith('BRIEF_MISSING expected=2026-11-21') for x in issues))
        self.assertTrue(any(x.startswith('US_CLOSE_STALE') for x in issues))

    def test_current_calendar_day_with_wrong_us_session_does_not_pass(self):
        now = datetime(2026, 11, 21, 7, 7, tzinfo=KST)
        latest = {'report_date_kst': '2026-11-21', 'market_date_us': '2026-11-19'}
        issues = decide(now, latest, {'us_completed_session_date': '2026-11-20'})
        self.assertEqual(len(issues), 1)
        self.assertIn('WRONG_MARKET_SESSION', issues[0])
        self.assertTrue(issues[0].startswith('BRIEF_MISSING expected=2026-11-21'))

    def test_missing_or_conflicted_archive_fails_despite_correct_latest(self):
        now = datetime(2026, 11, 21, 7, 7, tzinfo=KST)
        latest = {'report_date_kst': '2026-11-21', 'market_date_us': '2026-11-20',
                  'title': 'Report', 'generated_kst': '2026-11-21T06:35:00+09:00',
                  'published_kst': '2026-11-21T06:36:00+09:00'}
        head = dict(latest, path='20261121.json')
        index = {'entries': [head]}
        obs = {'us_completed_session_date': '2026-11-20'}
        self.assertEqual(decide(now, latest, obs, index=index, archive=dict(latest)), [])
        self.assertIn('ARCHIVE_MISMATCH_OR_MISSING',
                      ' '.join(decide(now, latest, obs, index=index, archive={})))
        self.assertIn('INDEX_OR_ARCHIVE_METADATA_MISMATCH',
                      ' '.join(decide(now, latest, obs, index={'entries': []}, archive=latest)))
        bad = dict(head, market_date_us='2026-11-19')
        self.assertIn('INDEX_OR_ARCHIVE_METADATA_MISMATCH',
                      ' '.join(decide(now, latest, obs, index={'entries': [bad]}, archive=latest)))

    def test_malformed_index_must_be_missing_report_not_uncaught_exception(self):
        now = datetime(2026, 11, 21, 7, 7, tzinfo=KST)
        latest = {'report_date_kst': '2026-11-21', 'market_date_us': '2026-11-20',
                  'title': 'test', 'generated_kst': '2026-11-21T06:50:00+09:00',
                  'published_kst': '2026-11-21T06:51:00+09:00'}
        obs = {'us_completed_session_date': '2026-11-20'}
        for index in ({'entries': {'bad': 'not-a-list'}}, {'entries': ['bad-first-entry']}):
            issues = decide(now, latest, obs, index=index, archive=latest)
            self.assertEqual(len(issues), 1)
            self.assertTrue(issues[0].startswith('BRIEF_MISSING expected=2026-11-21'))
            self.assertIn('INDEX_OR_ARCHIVE_METADATA_MISMATCH', issues[0])

    def test_monday_brief_not_checked(self):
        now = datetime(2026, 11, 16, 7, 7, tzinfo=KST)  # Monday: separate edition
        p = decide(now, {'report_date_kst': '2026-11-15'}, {'us_completed_session_date': '2026-11-13'})
        self.assertEqual(p, [])


if __name__ == '__main__':
    unittest.main()
