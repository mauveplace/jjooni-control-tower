import pathlib
import sys
import unittest
from copy import deepcopy
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from morning_source_ready_handoff import assess

KST = ZoneInfo("Asia/Seoul")


def case(report_present=False):
    day, session = "2026-11-21", "2026-11-20"
    obs = {"us_completed_session_date": session}
    pulse = {"market_date_us": session, "snapshot_status": "FINAL",
             "session_gate": {"aligned": True}, "read_only": True}
    public = {"tripod_signal": {"date": session, "ok": True}, "read_only": True}
    glance = {"us_session": session, "tripod": {"session": session},
              "consistency": {"status": "OK"}, "read_only": True, "no_trade": True}
    sectors = {"completed_cutoffs": {"US": session, "KR": session},
               "groups": [
                   {"key": "classic", "rows": [{"status": "OK"}] * 11},
                   {"key": "kr_sector", "rows": [{"status": "OK"}] * 10},
                   {"key": "theme", "rows": [{"status": "OK"}] * 13},
               ]}
    latest = {"report_date_kst": day if report_present else "2026-11-20",
              "market_date_us": session if report_present else "2026-11-19",
              "title": "test", "generated_kst": "2026-11-21T07:01:00+09:00",
              "published_kst": "2026-11-21T07:02:00+09:00"}
    index = {"entries": [dict(latest, path="20261121.json")]} if report_present else {"entries": []}
    archive = deepcopy(latest) if report_present else {}
    return [obs, pulse, public, glance, sectors, latest, index, archive]


class SourceReadyHandoff(unittest.TestCase):
    def state(self, now, sources):
        return assess(datetime.fromisoformat(now), *sources)

    def test_2026_nov21_source_ready_after_0630_no_brief_creates_handoff(self):
        x = self.state("2026-11-21T06:37:00+09:00", case())
        self.assertEqual(x["status"], "SOURCE_READY_UNPUBLISHED")
        self.assertTrue(x["source_ready"] and x["needs_handoff"])
        self.assertEqual(x["report_date_kst"], "2026-11-21")
        self.assertEqual(x["market_date_us"], "2026-11-20")
        self.assertEqual(x["sector_rows"], 34)

    def test_early_gate_never_calls_missing_even_with_ready_source(self):
        x = self.state("2026-11-21T06:29:59+09:00", case())
        self.assertEqual(x["status"], "NOT_DUE")
        self.assertFalse(x["needs_handoff"])

    def test_source_stale_0637_skips_handoff_and_fails_closed(self):
        a = case()
        a[0]["us_completed_session_date"] = "2026-11-19"
        x = self.state("2026-11-21T06:37:00+09:00", a)
        self.assertEqual(x["status"], "SOURCE_PENDING")
        self.assertFalse(x["needs_handoff"])

    def test_source_ready_but_incomplete_sectors_fails_closed(self):
        a = case()
        a[4]["groups"][2]["rows"] = [{"status": "OK"}] * 12
        x = self.state("2026-11-21T07:35:00+09:00", a)
        self.assertEqual(x["status"], "SOURCE_PENDING")
        self.assertEqual(x["sector_rows"], 33)
        self.assertFalse(x["needs_handoff"])

    def test_live_three_files_published_gives_healthy_no_handoff(self):
        x = self.state("2026-11-21T15:59:00+09:00", case(True))
        self.assertEqual(x["status"], "PUBLISHED")
        self.assertFalse(x["needs_handoff"])
        self.assertEqual(x["brief_problems"], [])

    def test_same_date_but_wrong_session_requires_handoff(self):
        a = case(True)
        a[5]["market_date_us"] = "2026-11-19"
        a[6]["entries"][0]["market_date_us"] = "2026-11-19"
        a[7]["market_date_us"] = "2026-11-19"
        x = self.state("2026-11-21T08:00:00+09:00", a)
        self.assertEqual(x["status"], "SOURCE_READY_UNPUBLISHED")
        self.assertTrue(x["needs_handoff"])

    def test_missing_index_or_archive_requires_handoff_even_with_matching_latest(self):
        a = case(True)
        a[7] = {}
        self.assertTrue(self.state("2026-11-21T08:00:00+09:00", a)["needs_handoff"])
        a = case(True)
        a[6] = {"entries": {"bad": "not a list"}}
        # The separate publication sentinel must fail loudly rather than false PASS.
        try:
            result = self.state("2026-11-21T08:00:00+09:00", a)
        except (TypeError, KeyError) as e:
            self.fail("A malformed index must be handled as a recoverable missing report: "+str(e))
        self.assertTrue(result["needs_handoff"])

    def test_sunday_and_monday_do_not_generate_phantom_reports(self):
        for stamp in ("2026-11-22T09:00:00+09:00", "2026-11-23T09:00:00+09:00"):
            x = self.state(stamp, case())
            self.assertFalse(x["needs_handoff"], x)
            self.assertEqual(x["status"], "NOT_DUE")

    def test_thanksgiving_full_us_holiday_does_not_require_report(self):
        x = self.state("2026-11-27T07:15:00+09:00", case())
        self.assertEqual(x["status"], "NOT_DUE")

    def test_nyse_friday_early_close_still_requires_saturday_brief(self):
        a = case()
        for entry in (a[0],):
            entry["us_completed_session_date"] = "2026-11-27"
        a[1]["market_date_us"] = "2026-11-27"
        a[2]["tripod_signal"]["date"] = "2026-11-27"
        a[3]["us_session"] = "2026-11-27"
        a[3]["tripod"]["session"] = "2026-11-27"
        a[4]["completed_cutoffs"]["US"] = "2026-11-27"
        x = self.state("2026-11-28T07:10:00+09:00", a)
        self.assertEqual(x["status"], "SOURCE_READY_UNPUBLISHED")
        self.assertTrue(x["needs_handoff"])

    def test_event_is_not_only_delayed_cron_and_same_date_issue_is_deduped(self):
        workflow = (ROOT / ".github/workflows/morning-brief-source-ready-handoff.yml").read_text()
        self.assertIn("workflow_run:", workflow)
        self.assertIn("Market Observatory Close Freshness Watchdog", workflow)
        self.assertIn("Market Observatory Daily Pulse", workflow)
        self.assertIn("gh issue list", workflow)
        self.assertIn("--state all", workflow)
        self.assertIn("MORNING_BRIEF_HANDOFF=ALREADY_TRACKED", workflow)
        self.assertNotIn("gh workflow run market-observatory-close-watchdog.yml", workflow)


if __name__ == "__main__":
    unittest.main()
