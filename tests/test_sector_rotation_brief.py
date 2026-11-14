"""No-network tests: the SAME Observatory bars must drive the morning sector story."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from build_sector_rotation_brief import make_digest, SECTOR_KO, KR_CATALOG, THEME_GROUPS


def fixture():
    dates = ["2026-11-11", "2026-11-12", "2026-11-13"]
    groups = []
    series = {}
    for key, tickers in (
        ("classic", list(SECTOR_KO)),
        ("kr_sector", list(KR_CATALOG)),
        *[(k, [k.upper()]) for k in THEME_GROUPS],
    ):
        rows = []
        for t in tickers:
            series[t] = [{"date": dt, "value": px}
                         for dt, px in zip(dates, [100, 102, 101])]
            rows.append({"ticker": t, "name": t, "market": "KR" if key == "kr_sector" else "US",
                         "observed_date": dates[-1], "ret_1d_pct": -0.980392})
        groups.append({"key": key, "label": key, "rows": rows})
    return {
        "schema": "JJOONI_OBSERVATORY_SECTOR_ETF_V1",
        "read_only": True, "contains_account_data": False,
        "daily_bar_contract": "PER_MARKET_COMPLETED_CUTOFF_V1",
        "generated_kst": "2026-11-14T07:41:47+09:00",
        "completed_cutoffs": {"US": dates[-1], "KR": dates[-1]},
        "groups": groups, "series": series,
    }


class ExistingVerticalSectorSSOT(unittest.TestCase):
    def test_all_existing_sectors_not_an_invented_five_etf_watchlist(self):
        d = make_digest(fixture())
        self.assertEqual(d["schema"], "JJOONI_SECTOR_ROTATION_BRIEF_V1")
        self.assertEqual(d["quality"]["us_classic_coverage"], 11)
        self.assertEqual(d["quality"]["kr_sector_coverage"], 10)
        self.assertEqual([g["key"] for g in d["groups"]], ["classic", "kr_sector", *THEME_GROUPS])
        self.assertEqual([r["ticker"] for r in d["groups"][0]["rows"]], list(SECTOR_KO))
        self.assertFalse(d["contains_account_data"])
        self.assertEqual(d["flow_evidence"], "PRICE_PERFORMANCE_PROXY_ONLY_NOT_NET_INFLOWS")

    def test_two_completed_returns_and_sign_flip_not_money_flow(self):
        d = make_digest(fixture())
        r = d["groups"][0]["rows"][0]
        self.assertEqual(r["previous_session"], "2026-11-12")
        self.assertEqual(r["current_session"], "2026-11-13")
        self.assertEqual(r["previous_return_pct"], 2.0)
        self.assertEqual(r["current_return_pct"], -0.98)
        self.assertEqual(r["change_pp"], -2.98)
        self.assertEqual(r["direction"], "TURN_NEGATIVE")
        self.assertEqual(r["status"], "OK")
        self.assertNotIn("inflow", r)

    def test_no_stale_or_future_session_laundering(self):
        s = fixture()
        s["series"]["XLK"][-1]["date"] = "2026-11-12"
        d = make_digest(s)
        self.assertEqual(d["quality"]["us_classic_coverage"], 10)
        self.assertEqual(d["groups"][0]["rows"][0]["status"], "MISSING_OR_STALE_BAR")
        self.assertIsNone(d["groups"][0]["rows"][0]["current_return_pct"])
        s = fixture()
        s["series"]["XLK"][-1]["date"] = "2026-11-14"
        self.assertEqual(make_digest(s)["groups"][0]["rows"][0]["status"],
                         "MISSING_OR_STALE_BAR")

    def test_source_return_mismatch_is_not_displayed_as_verified(self):
        s = fixture()
        s["groups"][0]["rows"][0]["ret_1d_pct"] = 10
        r = make_digest(s)["groups"][0]["rows"][0]
        self.assertEqual(r["status"], "SOURCE_RETURN_CONFLICT")
        self.assertIsNone(r["change_pp"])

    def test_us_and_kr_local_sessions_are_separate(self):
        s = fixture()
        s["completed_cutoffs"]["KR"] = "2026-11-12"
        d = make_digest(s)
        self.assertEqual(d["quality"]["us_classic_coverage"], 11)
        self.assertEqual(d["quality"]["kr_sector_coverage"], 0)
        self.assertEqual(d["completed_cutoffs"]["KR"], "2026-11-12")

    def test_public_source_contract_and_sector_registry_are_fail_closed(self):
        s = fixture()
        s["contains_account_data"] = True
        with self.assertRaisesRegex(AssertionError, "PUBLIC_DATA_ONLY"):
            make_digest(s)
        s = fixture()
        s["groups"][0]["rows"].pop()
        with self.assertRaisesRegex(AssertionError, "US_11_BOARD_REGISTRY"):
            make_digest(s)


if __name__ == "__main__":
    unittest.main()
