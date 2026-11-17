"""Offline parser and strict date-/source-boundary tests for official Nasdaq EOD."""
import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import collect_ndx_official_eod as official

class NasdaqIndexOfficialEOD(unittest.TestCase):
    def test_official_public_html_header_parsed_as_exact_date_and_level(self):
        s="<html><body><h1>NASDAQ-100</h1><span>NDX</span><p>DATA AS OF 11/16/2026 27,197.15 -763.08 -2.67%</p></body></html>"
        self.assertEqual(official.parse_official_index_page(s), ("2026-11-16", 27197.15))

    def test_embedded_scripts_dont_count_as_published_eod(self):
        with self.assertRaises(ValueError):
            official.parse_official_index_page("<script>DATA AS OF 11/16/2026 27,197.15</script><div>loading...</div>")

    def test_unavailable_or_ambiguous_header_fails_closed(self):
        for s in ("DATA AS OF 11/16/2026 —", "Nov 16, 2026 27,197.15", "DATA AS OF 11/16/2026 7.15", ""):
            with self.subTest(s=s), self.assertRaises(ValueError):
                official.parse_official_index_page(s)

    def test_proof_schema_and_explicit_integer_rule(self):
        at=datetime(2026,11,17,12,58,tzinfo=timezone(timedelta(hours=9)))
        o=official.build_evidence("2026-11-16", 27197.15, collected_at=at)
        self.assertEqual(o["session_date"],"2026-11-16")
        self.assertEqual(o["source_type"],"NASDAQ_INDEXES_OFFICIAL")
        self.assertEqual(o["comparison_rule"],"TRUNCATE_INTEGER_PART")
        self.assertEqual(o["source_url"],"https://indexes.nasdaqomx.com/Index/Overview/ndx")
        self.assertEqual(o["observed_at_kst"],"2026-11-17T12:58:00+09:00")

if __name__=="__main__":
    unittest.main()
