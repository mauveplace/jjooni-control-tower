"""Official GDP provenance/quarter guard regression tests (no live network)."""
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
import official_calendar_collectors as collectors

OFFICIAL = (
    "2026년 3/4분기 실질 국내총생산(속보) "
    "등록일 2026.10.27 "
    "◈ 실질 국내총생산(GDP)은 전기대비 1.0% 성장, "
    "전년동기대비 3.4% 성장 "
    "◈ 실질 국내총소득(GDI)은 전기대비 3.4% 증가, "
    "전년동기대비 18.8% 증가"
)


def event(ref="KR::2026년-3분기-실질-gdp"):
    return {
        "title": "2026년 3/4분기 실질 GDP(속보)",
        "country": "KR",
        "datetime_kst": "2026-10-27T08:00:00+09:00",
        "history_ref": ref,
    }


class BokGdpOfficialTest(unittest.TestCase):
    def test_exact_q3_preliminary_qoq_not_yoy_or_gdi(self):
        self.assertEqual(
            collectors.parse_bok_gdp(OFFICIAL, 2026, 3, "2026-10-27"),
            [{"key": "gdp_qoq", "label": "Real GDP QoQ (preliminary)", "actual": "1.0%"}],
        )

    def test_wrong_quarter_or_publication_date_rejected(self):
        for year, quarter, date in [(2026, 4, "2026-10-27"), (2025, 3, "2026-10-27"),
                                    (2026, 3, "2026-10-28")]:
            with self.subTest(year=year, quarter=quarter, date=date):
                with self.assertRaises(ValueError):
                    collectors.parse_bok_gdp(OFFICIAL, year, quarter, date)

    def test_missing_gdp_headline_cannot_use_gdi_or_yoy(self):
        with self.assertRaisesRegex(ValueError, "BOK_GDP_QOQ_HEADLINE_PARSE_MISS"):
            collectors.parse_bok_gdp(
                OFFICIAL.replace("◈ 실질 국내총생산(GDP)은 전기대비 1.0% 성장, ", ""),
                2026, 3, "2026-10-27",
            )

    def test_q4_history_ref_fails_closed_without_fetch(self):
        checks = []
        with patch.object(collectors, "text_fetch") as fetch:
            result = collectors.collect_bok_gdp(event("KR::2026년-4분기-실질-gdp"), checks)
        self.assertIsNone(result)
        fetch.assert_not_called()
        self.assertEqual(checks[-1]["result"], "HISTORY_REF_QUARTER_MISMATCH")

    def test_verified_identity_can_fetch_exact_bok_page(self):
        checks = []
        with patch.object(collectors, "text_fetch", return_value=OFFICIAL) as fetch:
            result = collectors.collect_bok_gdp(event(), checks)
        self.assertEqual(result[0][0]["actual"], "1.0%")
        self.assertIn("nttId=11065944", result[1])
        fetch.assert_called_once()
        self.assertEqual(checks[-1]["result"], "PARSED")

    def test_source_unavailable_remains_unresolved(self):
        checks = []
        with patch.object(collectors, "text_fetch", side_effect=OSError("offline")):
            self.assertIsNone(collectors.collect_bok_gdp(event(), checks))
        self.assertEqual(checks[-1]["result"], "OSError")

    def test_only_kr_q3_gdp_event_is_registered(self):
        self.assertEqual(collectors.adapter_id(event()), "BOK_GDP")
        other = event()
        other["country"] = "US"
        self.assertIsNone(collectors.adapter_id(other))


if __name__ == "__main__":
    unittest.main()
