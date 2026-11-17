"""FX session audit: a later Asian quote date is not a broken US cash close."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_observatory_data import normalize_fx_regional_session

def group(dxy, regional, mismatch=False):
    items = {"DXY": {"last_date": dxy}}
    items.update({k: {"last_date": regional} for k in ("USDKRW", "USDJPY", "JPYKRW")})
    return {"state": "AHEAD_OF_ANCHOR", "items": items, "missing": [],
            "latest_mismatch": ["USDJPY"] if mismatch else []}

class FXSessionTests(unittest.TestCase):
    def test_next_asian_date_is_live_but_not_falsely_same_session(self):
        g=group("2026-11-16", "2026-11-17")
        self.assertTrue(normalize_fx_regional_session(g, "2026-11-16", "2026-11-17"))
        self.assertEqual(g["state"], "LIVE")
        self.assertTrue(g["mixed_session"])
        self.assertEqual(g["items"]["DXY"]["last_date"], "2026-11-16")
        self.assertEqual(g["items"]["USDKRW"]["last_date"], "2026-11-17")
        self.assertEqual(g["regional_fx_as_of"], "2026-11-17")

    def test_future_dated_fx_stays_warning(self):
        g=group("2026-11-16", "2026-11-18")
        self.assertFalse(normalize_fx_regional_session(g, "2026-11-16", "2026-11-17"))
        self.assertEqual(g["state"], "AHEAD_OF_ANCHOR")

    def test_missing_or_inconsistent_quote_not_silenced(self):
        for g in [group("2026-11-16","2026-11-17", True),
                  group("2026-11-15","2026-11-17"),
                  group("2026-11-16",None)]:
            self.assertFalse(normalize_fx_regional_session(g, "2026-11-16","2026-11-17"))

    def test_wrong_session_and_weekend_horizon(self):
        weekend=group("2026-11-13", "2026-11-16")
        self.assertTrue(normalize_fx_regional_session(weekend,"2026-11-13","2026-11-16"))
        stale=group("2026-11-13", "2026-11-16")
        self.assertFalse(normalize_fx_regional_session(stale,"2026-11-13","2026-11-19"))

if __name__ == "__main__":
    unittest.main()
