#!/usr/bin/env python3
"""Read-only public Nasdaq Indexes EOD proof collector. Fail closed on blocked HTML.

Only the official Nasdaq Indexes NDX overview counts as official authority.
Do NOT use the same Yahoo/Observatory bar to manufacture independent proof.
The file is a dated evidence snapshot; never reuse it for a new US session.
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "market-observatory" / "data"
URL = "https://indexes.nasdaqomx.com/Index/Overview/ndx"
KST = ZoneInfo("Asia/Seoul")


def parse_official_index_page(raw: str):
    """Require a dated Nasdaq 'DATA AS OF' header with an unambiguous numeric level."""
    without_scripts = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", without_scripts)))
    match = re.search(r"DATA\s+AS\s+OF\s+(\d{1,2}/\d{1,2}/\d{4})\s+([\d,]+\.\d{2})(?!\d)", text, re.I)
    if not match:
        raise ValueError("NASDAQ_OFFICIAL_HEADER_OR_PRICE_MISSING")
    d = datetime.strptime(match.group(1), "%m/%d/%Y").date().isoformat()
    price = float(match.group(2).replace(",", ""))
    if not (1000 < price < 100000):
        raise ValueError("NASDAQ_NDX_LEVEL_OUT_OF_RANGE")
    return d, price


def build_evidence(session, price, collected_at=None):
    collected_at = collected_at or datetime.now(KST)
    return {
        "schema": "JJOONI_NDX_OFFICIAL_EOD_EVIDENCE_V1",
        "symbol": "NDX", "session_date": session, "close": price,
        "source_name": "Nasdaq Indexes official NASDAQ-100 overview",
        "source_type": "NASDAQ_INDEXES_OFFICIAL", "source_url": URL,
        "observation_kind": "PUBLISHED_COMPLETED_SESSION",
        "observed_at_kst": collected_at.isoformat(timespec="seconds"),
        "method": "PUBLIC_OFFICIAL_NASDAQ_OVERVIEW_HTML",
        "comparison_rule": "TRUNCATE_INTEGER_PART",
        "notes": "Dated Nasdaq official DATA AS OF level. Same-session integer-part match to the independent published Observatory Yahoo bar is checked by build_daily_glance. No account, trade or order access."
    }


def main():
    canonical = json.loads((DATA / "observatory.json").read_text(encoding="utf-8"))
    session = canonical.get("us_completed_session_date")
    if not session:
        print("NDX_OFFICIAL_SOURCE_UNAVAILABLE:NO_CANONICAL_SESSION")
        return 0
    req = Request(URL, headers={"User-Agent": "Mozilla/5.0 (compatible; JJOONI-EOD-check/1.0)",
                                "Accept": "text/html,application/xhtml+xml"})
    try:
        with urlopen(req, timeout=7) as response:
            page = response.read(2_000_000).decode("utf-8", "replace")
        source_session, close = parse_official_index_page(page)
    except Exception as exc:
        print(f"NDX_OFFICIAL_SOURCE_UNAVAILABLE:{type(exc).__name__}:{str(exc)[:120]}")
        # Retain dated prior proof; its session guard prevents stale reuse.
        return 0
    if source_session != session:
        print(f"NDX_OFFICIAL_SESSION_NOT_READY:official={source_session}:canonical={session}")
        return 0
    out = DATA / "ndx-official-eod.json"
    original = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    if (original.get("session_date") == session and
            original.get("close") == close):
        print(f"NDX_OFFICIAL_ALREADY_CURRENT:{session}:{close:.2f}")
        return 0
    data = build_evidence(session, close)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"NDX_OFFICIAL_PUBLISHED:{session}:{close:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
