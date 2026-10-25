import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import calendar_stockchild_gap_watch as gap

KST = ZoneInfo("Asia/Seoul")
NOW = datetime(2026, 10, 25, 12, 0, tzinfo=KST)
PAGE = """
<article><h1>10월 5주 증시일정 캘린더 빅테크</h1>
<ul><li>10월 27일 2026년 3분기 애플 실적 발표</li>
<li>10/28 미국 FOMC 회의 결과 발표</li>
<li>10월 29일 구글 실적 발표</li>
<li>10월 30일 한국 고용동향 발표</li>
<li>11월 40일 메타 실적 발표</li>
<li>지난주 10월 10일 테슬라 실적 발표</li>
<li>10월 30일 장보기 기록</li></ul></article>
"""


class StockchildGapReviewTests(unittest.TestCase):
    def test_extracts_only_explicit_upcoming_dates(self):
        x = gap.extract_candidates(PAGE, gap.PINNED, NOW.date())
        self.assertEqual([r["date"] for r in x],
                         ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"])
        self.assertTrue(all(r["verification"] == "UNVERIFIED_SECONDARY_CANDIDATE" for r in x))
        self.assertTrue(all(r["time_status"] == "UNCONFIRMED" for r in x))

    def test_existing_dates_and_same_title_not_reinserted(self):
        x = gap.extract_candidates(PAGE, gap.PINNED, NOW.date())
        doc = {"events": [{"datetime_kst": "2026-10-29T00:00+09:00",
                            "title": "구글 실적 발표"}]}
        missed = gap.missing_candidates(x, doc)
        self.assertEqual(len(missed), 3)
        self.assertFalse(any("구글" in r["title"] for r in missed))
        self.assertEqual(len(doc["events"]), 1)

    def test_no_network_returns_empty_not_an_error(self):
        doc = {"events": [{"title": "official", "actual": "1.0"}]}
        def down(url):
            raise ConnectionError("the optional website is offline")
        result = gap.review(doc, NOW, down)
        self.assertEqual(result["state"], "OPTIONAL_UNAVAILABLE")
        self.assertEqual(result["candidate_events"], [])
        self.assertEqual(doc["events"][0]["actual"], "1.0")

    def test_daily_check_avoids_repeated_network_requests(self):
        doc = {"events": []}
        fetched = Mock(return_value=PAGE)
        gap.review(doc, NOW, fetched)
        count = fetched.call_count
        gap.review(doc, NOW.replace(hour=18), fetched)
        self.assertEqual(fetched.call_count, count)

    def test_wordpress_feed_needs_allowlisted_link(self):
        feed = """<rss><channel>
        <item><title>11월 1주 증시일정 캘린더</title>
        <link>https://stockchild.com/november-calendar/</link></item>
        <item><title>11월 1주 증시일정 캘린더</title>
        <link>https://untrusted.invalid/malicious/</link></item>
        <item><title>오늘의 맛집</title><link>https://stockchild.com/food/</link></item>
        </channel></rss>"""
        self.assertEqual(gap.recent_posts(feed, NOW),
                         ["https://stockchild.com/november-calendar/"])


if __name__ == "__main__":
    unittest.main()
