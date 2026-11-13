"""P0 regression: report published before latest canonical must NEVER pass preflight."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from check_morning_brief_readiness import verify

SESSION="2026-11-13"
def sample():
    brief={"market_date_us":SESSION, "generated_kst":"2026-11-14T06:47:00+09:00",
           "published_kst":"2026-11-14T06:48:00+09:00",
           "editorial_contract":{"verified_at_kst":"2026-11-14T06:46:00+09:00"},
           "read_only":True,"contains_account_data":False}
    obs={"generated_kst":"2026-11-14T06:34:06+09:00",
         "us_completed_session_date":SESSION,
         "series":{k:[{"date":SESSION,"value":100}] for k in ("NASDAQ100","SP500","VIX")}}
    pulse={"generated_kst":"2026-11-14T06:34:38+09:00",
           "market_date_us":SESSION,"snapshot_status":"FINAL","read_only":True,
           "session_gate":{"aligned":True,"core_dates":{k:SESSION for k in ("NASDAQ100","SP500","VIX")}}}
    glance={"generated_kst":"2026-11-14T06:36:45+09:00",
            "source_generated_kst":obs["generated_kst"],"us_session":SESSION,
            "tripod":{"session":SESSION},"consistency":{"status":"OK"},
            "read_only":True,"no_trade":True}
    return brief,obs,pulse,glance

class MorningReadinessTests(unittest.TestCase):
    def test_new_1645_et_release_after_canonical_passes(self):
        result=verify(*sample())
        self.assertEqual(result["session"],SESSION)
        self.assertIs(result["official_close_verified"],False)

    def test_real_nov14_report_before_canonical_fails(self):
        args=list(sample())
        args[0]["generated_kst"]="2026-11-14T06:31:00+09:00"
        args[0]["published_kst"]="2026-11-14T06:32:48+09:00"
        args[0]["editorial_contract"]["verified_at_kst"]="2026-11-14T06:31:00+09:00"
        with self.assertRaisesRegex(ValueError,"REPORT_PREDATES_CANONICAL_SOURCE"):
            verify(*args)

    def test_old_session_at_same_clock_cannot_be_published(self):
        args=list(sample())
        args[1]["us_completed_session_date"]="2026-11-12"
        with self.assertRaisesRegex(ValueError,"CANONICAL_SESSION_NOT_READY"):
            verify(*args)

    def test_core_dates_and_single_source_status_not_exaggerated(self):
        args=list(sample())
        args[2]["session_gate"]["core_dates"]["NASDAQ100"]="2026-11-12"
        with self.assertRaisesRegex(ValueError,"PULSE_CORE_DATES_STALE"):
            verify(*args)
        args=list(sample())
        args[2]["snapshot_status"]="PROVISIONAL"
        with self.assertRaisesRegex(ValueError,"CANONICAL_STATUS_NOT_READY"):
            verify(*args)

    def test_glance_not_newer_than_report_verification(self):
        args=list(sample())
        args[3]["generated_kst"]="2026-11-14T06:49:00+09:00"
        with self.assertRaisesRegex(ValueError,"REPORT_PREDATES_CANONICAL_SOURCE"):
            verify(*args)

    def test_derived_glance_vintage_must_match_original(self):
        args=list(sample())
        args[3]["source_generated_kst"]="2026-11-13T06:34:06+09:00"
        with self.assertRaisesRegex(ValueError,"GLANCE_VINTAGE_NOT_MATCHING_OBSERVATORY"):
            verify(*args)

    def test_missing_or_untrusted_data_blocks(self):
        args=list(sample());args[1]["series"]["VIX"]=[]
        with self.assertRaisesRegex(ValueError,"OBSERVATORY_CORE_DATES_STALE"):
            verify(*args)
        args=list(sample());args[3]["no_trade"]=False
        with self.assertRaisesRegex(ValueError,"CANONICAL_STATUS_NOT_READY"):
            verify(*args)
        args=list(sample());args[2].pop("market_date_us")
        with self.assertRaisesRegex(ValueError,"CANONICAL_EVIDENCE_INCOMPLETE"):
            verify(*args)

    def test_weekend_and_early_close_are_session_calendar_aware(self):
        args=list(sample())
        args[0]["editorial_contract"]["verified_at_kst"]="2026-11-15T06:46:00+09:00"
        args[0]["generated_kst"]="2026-11-15T06:47:00+09:00"
        args[0]["published_kst"]="2026-11-15T06:48:00+09:00"
        self.assertEqual(verify(*args)["session"],SESSION)

if __name__=="__main__":
    unittest.main()
