import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_daily_glance as glance  # noqa: E402


def series(*values, start=1):
    return [{"date": f"2026-11-{start + i:02d}", "value": v} for i, v in enumerate(values)]


def observatory(**over):
    obs = {
        "us_completed_session_date": "2026-11-06",
        "generated_kst": "2026-11-09T08:48:09+09:00",
        "tripod_latest": {"ok": True, "date": "2026-11-06", "session_date": "2026-11-06",
                          "ndx": 26989.99, "ma250": 27451.44, "drawdown_52w_pct": -13.5614,
                          "vix10": 20.185, "regime": "상승", "target": "QQQ 50% + QLD 50%",
                          "target_changed": False},
        "series": {
            "NASDAQ100": series(27000, 26800, 26700, 26900, 26629.81, 26989.99),
            "KOSPI": series(5400, 5383.8, 5059.69, start=4),
            "NIKKEI225": series(61000, 61077.9, 57434.77, start=4),
            "HANGSENG": series(24700, 24796.98, 24481.86, start=4),
            "SHCOMP": series(3680, 3689.91, 3649.18, start=4),
            "USDKRW": series(1335, 1340.07, 1356.34, start=4),
            "US10Y": series(4.80, 4.837, 4.859, start=4),
            "BTCUSD": [{"date": "2026-11-06", "value": 75746.9}, {"date": "2026-11-07", "value": 75747.6},
                       {"date": "2026-11-08", "value": 1.0, "session_status": "IN_PROGRESS"}],
        },
    }
    obs.update(over)
    return obs


def brief(close, market_date="2026-11-06", status="VERIFIED", official="VERIFIED"):
    return {"report_date_kst": "2026-11-07", "market_date_us": market_date,
            "editorial_contract": {"close_checks": [{"symbol": "NDX", "close": close, "status": status,
                                                     "official_status": official}]}}


class DailyGlance(unittest.TestCase):
    def test_complete_ndx_provider_bar_can_be_seen_without_falsely_verifying_official_eod(self):
        g=glance.build(observatory(), brief(None, status="MISSING", official="MISSING"))
        result=g["brief_check"]
        self.assertEqual(result["status"], "NOT_COMPARABLE")
        self.assertEqual(result["reference_ndx"], 26989.99)
        self.assertFalse(result["official_eod_verified"])
        self.assertFalse(result["trade_signal_eligible"])
        self.assertIn("완료 일봉",result["text"])
        self.assertIn("공식 종가 독립검증",result["text"])

    def test_missing_ndx_bar_does_not_claim_provider_completion(self):
        obs=observatory()
        obs["series"]["NASDAQ100"]=[{"date":"2026-11-05","value":26000}]
        result=glance.build(obs, brief(None, status="MISSING", official="MISSING"))["brief_check"]
        self.assertEqual(result["status"],"NOT_COMPARABLE")
        self.assertIsNone(result["reference_ndx"])
        self.assertFalse(result["trade_signal_eligible"])

    def test_month_comparison_uses_completed_bar_and_correct_units(self):
        bars = [{"date": "2026-10-13", "value": 100},
                {"date": "2026-11-11", "value": 105},
                {"date": "2026-11-12", "value": 108},
                {"date": "2026-11-13", "value": 110},
                {"date": "2026-11-14", "value": 500, "session_status": "IN_PROGRESS"}]
        index = glance.metric("NASDAQ100", "나스닥100", bars)
        self.assertEqual(index["date"], "2026-11-13")
        self.assertEqual(index["m1_base_date"], "2026-10-13")
        self.assertEqual(index["m1_pct"], 10.0)
        rate = glance.metric("US2Y", "2y", [dict(b, value=b["value"]/100) for b in bars])
        self.assertEqual(rate["m1_bp"], 10.0)
        fear = glance.metric("FEAR_GREED", "FG", bars)
        self.assertEqual(fear["m1_pt"], 10.0)
        self.assertIsNone(glance.metric("SP500", "S&P500", bars[1:-1])["m1_pct"])

    def test_month_comparison_clamps_calendar_month_and_guards_currency(self):
        rows = [{"date": "2026-02-27", "value": 100},
                {"date": "2026-03-27", "value": 115},
                {"date": "2026-03-30", "value": 120},
                {"date": "2026-03-31", "value": 125}]
        m = glance.metric("SP500", "S&P", rows)
        self.assertEqual(m["m1_base_date"], "2026-02-27")
        self.assertEqual(m["m1_pct"], 25)
        missing = glance.metric("SP500", "S&P", [
            {"date": "2026-02-01", "value": 100}, *rows[1:]])
        self.assertIsNone(missing["m1_pct"])
        crypto = glance.metric("BTCUSD", "Bitcoin", [
            {"date": "2026-10-13", "value": 100, "quote_currency": "USD"},
            {"date": "2026-11-12", "value": 105, "quote_currency": "USDT"},
            {"date": "2026-11-13", "value": 110, "quote_currency": "USDT"}])
        self.assertIsNone(crypto["m1_pct"])
        self.assertIsNone(crypto["m1_base_date"])

    def test_tripod_lines_match_rule_thresholds(self):
        tri = glance.build(observatory())["tripod"]
        self.assertEqual(tri["pod"], "BIPOD")
        peak = 26989.99 / (1 - 0.135614)
        self.assertAlmostEqual(tri["lines"]["tripod_return"], round(peak * 0.91, 2), places=2)
        self.assertAlmostEqual(tri["lines"]["ma250_lower"], round(27451.44 * 0.95, 2), places=2)
        self.assertIn("NOPOD", tri["next_down"])  # VIX10 >= 18 below the lower band

    def test_numbers_come_from_series_and_ignore_in_progress_bars(self):
        g = glance.build(observatory())
        items = {i["key"]: i for grp in g["groups"] for i in grp["items"]}
        self.assertEqual(items["NASDAQ100"]["d1_pct"], 1.35)
        self.assertEqual(items["BTCUSD"]["date"], "2026-11-07")
        self.assertEqual(items["US10Y"]["d1_bp"], 2.2)
        self.assertEqual(items["SP500"]["status"], "MISSING")
        self.assertIn("SP500", g["quality"]["missing"])

    def test_optional_sox_yahoo_completed_bar_is_reference_not_trade_gate(self):
        obs = observatory()
        missing = glance.build(obs)
        items = {i["key"]: i for grp in missing["groups"] for i in grp["items"]}
        self.assertEqual(items["SOX"]["status"], "MISSING")
        self.assertTrue(missing["no_trade"])
        obs["series"]["SOX"] = series(10100, 10250, 10050, start=4)
        g = glance.build(obs)
        items = {i["key"]: i for grp in g["groups"] for i in grp["items"]}
        self.assertEqual(items["SOX"]["date"], "2026-11-06")
        self.assertEqual(items["SOX"]["value"], 10050)
        self.assertIsInstance(items["SOX"]["d1_pct"], (float, int))
        self.assertEqual(g["us_session"], "2026-11-06")
        self.assertTrue(g["no_trade"])
        self.assertNotIn("SOX", g["quality"]["missing"])

    def test_sox_gap_does_not_create_false_one_day_return(self):
        obs = observatory()
        # The last SOX observation is in the current session, but its
        # previous bar is not the immediately preceding NDX trading session.
        obs["series"]["SOX"] = [
            {"date": "2026-11-03", "value": 10000},
            {"date": "2026-11-06", "value": 10100},
        ]
        g = glance.build(obs)
        sox = next(i for x in g["groups"] for i in x["items"] if i["key"] == "SOX")
        self.assertEqual(sox["value"], 10100)
        self.assertIsNone(sox["d1_pct"])
        self.assertEqual(sox["comparison_status"], "PRIOR_SESSION_UNVERIFIED")
        self.assertTrue(g["no_trade"])

    def test_asia_cross_read_separates_aligned_and_divergent_peers(self):
        cross = {c["type"]: c for c in glance.build(observatory())["cross_read"]}
        self.assertIn("닛케이225와 동조", cross["ASIA_CROSS"]["kind"])
        self.assertIn("상대 선방", cross["ASIA_CROSS"]["kind"])
        self.assertIn("다음 KRX 세션", cross["TIME_LAG"]["text"])
        self.assertIn("외국인 이탈형", cross["FX"]["text"])

    def test_brief_mismatch_is_flagged(self):
        bad = glance.build(observatory(), brief(27154.71))["brief_check"]
        self.assertEqual(bad["status"], "MISMATCH")
        ok = glance.build(observatory(), brief(26989.99))["brief_check"]
        self.assertEqual(ok["status"], "MATCH")
        other = glance.build(observatory(), brief(26000, "2026-11-05"))["brief_check"]
        self.assertEqual(other["status"], "NOT_SAME_SESSION")

    def test_unverified_brief_close_is_never_certified(self):
        for status, official in (("CONFLICT", "NOT_VERIFIED"), ("CROSS_CHECKED", "DELAYED"),
                                 ("VERIFIED", "NOT_VERIFIED"), (None, None)):
            check = glance.build(observatory(), brief(26989.99, status=status, official=official))["brief_check"]
            self.assertEqual(check["status"], "UNVERIFIED", (status, official))

    def test_conflicting_official_close_with_matching_provider_reference_is_not_missing(self):
        d = brief(None, status="CONFLICT", official="CONFLICT")
        d["editorial_contract"]["reference_quotes"] = [{
            "symbol": "NDX", "session_date": "2026-11-06",
            "status": "PROVIDER_REFERENCE_ONLY",
            "official_eod_verified": False, "trade_signal_eligible": False,
            "close": 26989.99
        }]
        result = glance.build(observatory(), d)["brief_check"]
        self.assertEqual(result["status"], "REFERENCE_MATCH")
        self.assertEqual(result["official_status"], "CONFLICT")
        self.assertFalse(result["official_eod_verified"])
        self.assertFalse(result["trade_signal_eligible"])
        self.assertEqual(result["pipeline_ndx"], 26989.99)
        self.assertIn("공식 확정 종가 검증은 별도", result["text"])

    def test_conflicting_official_close_with_divergent_provider_reference_is_warning(self):
        d = brief(None, status="CONFLICT", official="CONFLICT")
        d["editorial_contract"]["reference_quotes"] = [{
            "symbol": "NDX", "session_date": "2026-11-06",
            "status": "PROVIDER_REFERENCE_ONLY",
            "official_eod_verified": False, "trade_signal_eligible": False,
            "close": 27800.0
        }]
        result = glance.build(observatory(), d)["brief_check"]
        self.assertEqual(result["status"], "REFERENCE_MISMATCH")
        self.assertFalse(result["official_eod_verified"])
        self.assertGreater(result["diff_pct"], 0.1)

    def test_no_reference_match_without_session_and_safety_provenance(self):
        d = brief(None, status="CONFLICT", official="CONFLICT")
        d["editorial_contract"]["reference_quotes"] = [{
            "symbol": "NDX", "session_date": "2026-11-05",
            "status": "PROVIDER_REFERENCE_ONLY",
            "official_eod_verified": False, "trade_signal_eligible": False,
            "close": 26989.99
        }]
        self.assertEqual(glance.build(observatory(), d)["brief_check"]["status"], "NOT_COMPARABLE")
        d["editorial_contract"]["reference_quotes"][0]["session_date"] = "2026-11-06"
        d["editorial_contract"]["reference_quotes"][0]["trade_signal_eligible"] = True
        self.assertEqual(glance.build(observatory(), d)["brief_check"]["status"], "NOT_COMPARABLE")

    def test_actual_20261110_ndx_reference_does_not_upgrade_strict_gate(self):
        published = json.loads((ROOT / "market-observatory/data/morning-brief/20261110.json").read_text())
        d = brief(None, market_date="2026-11-09", status="CONFLICT", official="CONFLICT")
        d["editorial_contract"]["reference_quotes"] = (
            published["editorial_contract"]["reference_quotes"])
        now_obs = observatory()
        now_obs["us_completed_session_date"] = "2026-11-09"
        now_obs["tripod_latest"] = dict(now_obs["tripod_latest"],
                                        date="2026-11-09", session_date="2026-11-09",
                                        ndx=27907.625)
        now_obs["series"]["NASDAQ100"].append(
            {"date": "2026-11-09", "value": 27907.625})
        result = glance.build(now_obs, d)["brief_check"]
        self.assertEqual(result["status"], "REFERENCE_MATCH")
        self.assertAlmostEqual(result["reference_ndx"], 27907.63, places=2)
        self.assertFalse(result["trade_signal_eligible"])

    def test_stale_signal_is_isolated_from_current_bar(self):
        stale = dict(observatory()["tripod_latest"], date="2026-11-05", session_date="2026-11-05", ndx=26629.81)
        g = glance.build(observatory(tripod_latest=stale))
        self.assertEqual(g["consistency"]["status"], "CONFLICT")
        self.assertIn("불일치", g["headline"])
        self.assertNotIn("26,630(+1.35%)", g["headline"])
        price_only = dict(observatory()["tripod_latest"], ndx=27154.71)
        self.assertEqual(glance.build(observatory(tripod_latest=price_only))["consistency"]["status"], "CONFLICT")
        self.assertEqual(glance.build(observatory())["consistency"]["status"], "OK")

    def test_glance_refreshes_on_canonical_pulse_commit_even_if_workflow_run_is_late(self):
        # A later same-session canonical pulse can otherwise make the
        # previous Glance source-vintage older and block morning publication.
        wf = (ROOT / ".github/workflows/market-observatory-daily-glance.yml").read_text(encoding="utf-8")
        push = wf.split("  push:", 1)[1].split("  pull_request:", 1)[0]
        self.assertIn("- market-observatory/data/daily-market-pulse.json", push)
        self.assertIn('workflows: ["Market Observatory Daily Pulse"]', wf)
        self.assertIn("python tools/build_daily_glance.py", wf)
        self.assertIn("python tools/publish_observatory_data.py", wf)
        self.assertIn("contents: read", wf.split("jobs:")[0])

    def test_workflow_write_token_only_in_publish_job(self):
        wf = (ROOT / ".github/workflows/market-observatory-daily-glance.yml").read_text(encoding="utf-8")
        top = wf.split("jobs:")[0]
        self.assertIn("contents: read", top)
        self.assertNotIn("contents: write", top)
        publish = wf.split("  publish:")[1]
        self.assertIn("contents: write", publish)
        self.assertIn("github.event_name != 'pull_request'", publish)

    def test_refuses_without_signal_and_never_carries_account_data(self):
        with self.assertRaises(ValueError):
            glance.build(observatory(tripod_latest={"ok": False}))
        g = glance.build(observatory())
        self.assertFalse(g["contains_account_data"])
        self.assertTrue(g["no_trade"])

    def test_page_mounts_versioned_runtime_once(self):
        html = (ROOT / "market-observatory/index.html").read_text(encoding="utf-8")
        self.assertEqual(html.count("daily-glance-v1.js?v="), 1)
        js = (ROOT / "market-observatory/daily-glance-v1.js").read_text(encoding="utf-8")
        self.assertIn("JJOONI_DAILY_GLANCE_V1", js)
        self.assertNotIn("innerHTML = g.", js)  # all fields pass through esc()


if __name__ == "__main__":
    unittest.main()
