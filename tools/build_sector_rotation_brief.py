#!/usr/bin/env python3
"""Small, zero-network morning digest of the EXISTING Song vertical sector board.

Single SSOT: market-observatory/data/sector-etf.json (completed Yahoo daily
reference bars). This module MUST NOT pull prices or define a new sector universe.
The existing Sector Observatory and the Morning Brief consume the same bars.
"""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "market-observatory/data/sector-etf.json"
OUTPUT = ROOT / "market-observatory/data/sector-rotation-brief.json"

# Matches the existing vertical "시장의 방향 · 섹터별 등락" US 11 labels.
SECTOR_KO = {
    "XLK": "기술", "XLC": "커뮤니케이션", "XLY": "경기소비재",
    "XLF": "금융", "XLI": "산업재", "XLE": "에너지",
    "XLB": "소재", "XLV": "헬스케어", "XLP": "필수소비재",
    "XLU": "유틸리티", "XLRE": "부동산",
}
US_CLASSIC = tuple(SECTOR_KO)
KR_CATALOG = ("091160", "091170", "091180", "102960", "117460",
              "117680", "117700", "140700", "266360", "266410")
THEME_GROUPS = ("semiconductor", "software", "biotech", "financial",
                "defense_infra", "robotics")


def number(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    return float(v)


def direction(before, current):
    if before is None or current is None:
        return "UNAVAILABLE"
    if before <= 0 < current:
        return "TURN_POSITIVE"
    if before >= 0 > current:
        return "TURN_NEGATIVE"
    if current > 0:
        return "REMAINS_POSITIVE"
    if current < 0:
        return "REMAINS_NEGATIVE"
    return "FLAT"


def rows_for_group(group, data, cutoff, market):
    rows = []
    for source_row in group["rows"]:
        ticker = source_row["ticker"]
        bars = (data.get("series") or {}).get(ticker) or []
        bars = [b for b in bars if isinstance(b, dict) and
                isinstance(b.get("date"), str) and number(b.get("value")) is not None]
        bars.sort(key=lambda x: x["date"])
        observed = source_row.get("observed_date")
        if (len(bars) < 3 or not cutoff or observed != cutoff or
                bars[-1]["date"] != cutoff or
                len({b["date"] for b in bars[-3:]}) != 3):
            previous = current = delta = None
            prev_day = None
            state = "MISSING_OR_STALE_BAR"
        else:
            a, b, c = [number(bar["value"]) for bar in bars[-3:]]
            prev_day = bars[-2]["date"]
            if not all(x is not None and x > 0 for x in (a, b, c)):
                previous = current = delta = None
                state = "BAD_BAR_VALUE"
            else:
                previous = (b/a-1)*100
                current = (c/b-1)*100
                expected = number(source_row.get("ret_1d_pct"))
                if expected is None or abs(expected-current) > .05:
                    previous = current = delta = None
                    state = "SOURCE_RETURN_CONFLICT"
                else:
                    delta = current-previous
                    state = "OK"
        rows.append({
            "ticker": ticker,
            "label": SECTOR_KO.get(ticker) or source_row.get("name") or ticker,
            "market": market,
            "previous_session": prev_day,
            "current_session": cutoff,
            "previous_return_pct": None if previous is None else round(previous, 2),
            "current_return_pct": None if current is None else round(current, 2),
            "change_pp": None if delta is None else round(delta, 2),
            "direction": direction(previous, current),
            "status": state,
            "data_origin": "OBSERVATORY_YAHOO_SINGLE_PROVIDER_COMPLETED_DAILY",
        })
    return rows


def make_digest(source):
    assert source.get("schema") == "JJOONI_OBSERVATORY_SECTOR_ETF_V1", "SECTOR_SOURCE_SCHEMA"
    assert source.get("read_only") is True and source.get("contains_account_data") is False, "PUBLIC_DATA_ONLY"
    assert source.get("daily_bar_contract") == "PER_MARKET_COMPLETED_CUTOFF_V1", "SOURCE_CLOSE_CONTRACT"
    cutoff = source.get("completed_cutoffs") or {}
    groups = {g["key"]: g for g in source.get("groups", [])}
    assert tuple(r["ticker"] for r in groups["classic"]["rows"]) == US_CLASSIC, "US_11_BOARD_REGISTRY"
    assert tuple(r["ticker"] for r in groups["kr_sector"]["rows"]) == KR_CATALOG, "KR_10_BOARD_REGISTRY"
    selected = []
    for key in ("classic", "kr_sector", *THEME_GROUPS):
        if key not in groups:
            raise AssertionError("EXISTING_SECTOR_GROUP_MISSING:" + key)
        market = "KR" if key == "kr_sector" else "US"
        rows = rows_for_group(groups[key], source, cutoff.get(market), market)
        selected.append({"key": key, "label": groups[key]["label"], "market": market,
                         "expected_count": len(groups[key]["rows"]), "rows": rows})
    out = {
        "schema": "JJOONI_SECTOR_ROTATION_BRIEF_V1",
        "generated_kst": source["generated_kst"],
        "source_path": "market-observatory/data/sector-etf.json",
        "source_schema": source["schema"],
        "source_generated_kst": source["generated_kst"],
        "read_only": True,
        "contains_account_data": False,
        "no_trade": True,
        "flow_evidence": "PRICE_PERFORMANCE_PROXY_ONLY_NOT_NET_INFLOWS",
        "completed_cutoffs": {"US": cutoff.get("US"), "KR": cutoff.get("KR")},
        "groups": selected,
        "quality": {
            "us_classic_coverage": sum(r["status"] == "OK" for r in selected[0]["rows"]),
            "kr_sector_coverage": sum(r["status"] == "OK" for r in selected[1]["rows"]),
            "us_classic_expected": 11,
            "kr_sector_expected": 10,
            "theme_groups": len(THEME_GROUPS),
        },
    }
    return out


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    out = make_digest(source)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SECTOR_ROTATION_BRIEF=PASS",
          "US="+str(out["quality"]["us_classic_coverage"])+"/11",
          "KR="+str(out["quality"]["kr_sector_coverage"])+"/10",
          "session="+str(out["completed_cutoffs"]))


if __name__ == "__main__":
    main()
