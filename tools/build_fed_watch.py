#!/usr/bin/env python3
from __future__ import annotations

import calendar as _calendar
import json
import math
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "market-observatory" / "data"
CALENDAR_FILE = DATA_DIR / "economic-calendar.json"
OUT = DATA_DIR / "fed-watch.json"

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")
UA = "Mozilla/5.0 JJOONI-FedWatch-Sensor/1.0"
CME_SETTLEMENTS_URL = (
    "https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/305/FUT"
)
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JLY": 7,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}
MONTH_ABBR = {v: k for k, v in MONTHS.items() if k != "JLY"}


def _session():
    return requests.Session(impersonate="chrome")


def _business_day(d: date) -> date:
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _prev_business_day(d: date) -> date:
    return _business_day(d - timedelta(days=1))


def _expected_latest_trade_date(now_et: datetime) -> date:
    d = now_et.date()
    if d.weekday() >= 5:
        return _business_day(d)
    # 30-Day Fed Funds normal daily settlement is set around 14:00 CT.
    # Give CME's public endpoint some publication buffer and use same-day
    # settlement only after 16:30 ET; otherwise use the prior business day.
    if now_et.timetz().replace(tzinfo=None) >= time(16, 30):
        return d
    return _prev_business_day(d)


def _fred_latest(series_id: str, lookback_days: int = 20) -> tuple[float, str]:
    end = datetime.now(ET).date()
    start = end - timedelta(days=lookback_days)
    r = _session().get(
        FRED_CSV,
        params={"id": series_id, "cosd": start.isoformat(), "coed": end.isoformat()},
        headers={"User-Agent": UA},
        timeout=25,
    )
    r.raise_for_status()
    rows = r.text.strip().splitlines()[1:]
    for line in reversed(rows):
        parts = line.split(",")
        if len(parts) != 2 or parts[1] in ("", "."):
            continue
        return float(parts[1]), parts[0]
    raise RuntimeError(f"FRED_NO_VALUE:{series_id}")


def _fetch_settlements_exact(trade_date: date) -> tuple[list[dict], date]:
    r = _session().get(
        CME_SETTLEMENTS_URL,
        params={"tradeDate": trade_date.strftime("%m/%d/%Y")},
        headers={
            "User-Agent": UA,
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://www.cmegroup.com/markets/interest-rates/stirs/30-day-federal-fund.settlements.html",
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    if data.get("empty"):
        raise RuntimeError("CME_EMPTY")
    out = []
    for row in data.get("settlements") or []:
        raw_month = str(row.get("month") or "").strip().upper()
        if raw_month == "TOTAL" or not raw_month:
            continue
        try:
            settle = float(str(row.get("settle") or "").replace(",", ""))
        except Exception:
            continue
        out.append(
            {
                "month": raw_month,
                "settle": settle,
                "volume": str(row.get("volume") or "0").replace(",", ""),
                "open_interest": str(row.get("openInterest") or "0").replace(",", ""),
            }
        )
    if not out:
        raise RuntimeError("CME_NO_SETTLEMENT_ROWS")
    return out, trade_date


def _fetch_latest_settlements(expected: date) -> tuple[list[dict], date]:
    d = expected
    last_error = None
    for _ in range(8):
        if d.weekday() >= 5:
            d = _business_day(d)
        try:
            return _fetch_settlements_exact(d)
        except Exception as exc:
            last_error = exc
            d = _prev_business_day(d)
    raise RuntimeError(f"CME_SETTLEMENT_UNAVAILABLE:{type(last_error).__name__}")


def _month_key_from_cme(label: str) -> tuple[int, int] | None:
    p = str(label).upper().replace("-", " ").split()
    if len(p) < 2 or p[0] not in MONTHS:
        return None
    y = int(p[1])
    y = 2000 + y if y < 100 else y
    return y, MONTHS[p[0]]


def _month_key(y: int, m: int) -> tuple[int, int]:
    return y, m


def _next_month(k: tuple[int, int]) -> tuple[int, int]:
    y, m = k
    return (y + 1, 1) if m == 12 else (y, m + 1)


def _prev_month(k: tuple[int, int]) -> tuple[int, int]:
    y, m = k
    return (y - 1, 12) if m == 1 else (y, m - 1)


def _load_fomc_meetings() -> list[date]:
    meetings: list[date] = []
    try:
        c = json.loads(CALENDAR_FILE.read_text(encoding="utf-8"))
        for e in c.get("events") or []:
            title = str(e.get("title") or "")
            source = str(e.get("source") or "")
            if "FOMC" not in title.upper() and source != "Federal Reserve":
                continue
            raw = str(e.get("datetime_kst") or e.get("date") or "")[:10]
            if not raw:
                continue
            # Calendar stores announcement time in KST. For the policy decision,
            # the underlying FOMC meeting date is the prior U.S. date when the
            # KST timestamp rolls past midnight.
            dt = datetime.fromisoformat(str(e.get("datetime_kst"))).astimezone(ET)
            meetings.append(dt.date())
    except Exception:
        pass
    if not meetings:
        # Defensive fallback for the currently supported official calendar.
        meetings = [
            date(2026, 1, 28), date(2026, 3, 18), date(2026, 4, 29), date(2026, 6, 17),
            date(2026, 7, 29), date(2026, 9, 16), date(2026, 10, 28), date(2026, 12, 9),
            date(2027, 1, 27), date(2027, 3, 17), date(2027, 4, 28), date(2027, 6, 9),
            date(2027, 7, 28), date(2027, 9, 15), date(2027, 10, 27), date(2027, 12, 8),
        ]
    return sorted(set(meetings))


def _meeting_by_month(meetings: list[date]) -> dict[tuple[int, int], date]:
    return {(d.year, d.month): d for d in meetings}


def _avg_rate_map(settlements: list[dict]) -> dict[tuple[int, int], float]:
    out = {}
    for s in settlements:
        k = _month_key_from_cme(s.get("month", ""))
        if k:
            out[k] = 100.0 - float(s["settle"])
    return out


def _meeting_expected_change(
    target: date,
    settlements: list[dict],
    all_meetings: list[date],
) -> dict:
    """Replicate the nearest-node CME FedWatch anchor-month methodology.

    For a meeting month, locate the nearest later full month with no FOMC
    meeting. That non-meeting month's average implied EFFR anchors the end rate
    of the preceding meeting month. Then propagate backward through consecutive
    meeting months using CME's day-weighted monthly-average equation.
    """
    avg = _avg_rate_map(settlements)
    by_month = _meeting_by_month(all_meetings)
    target_k = (target.year, target.month)
    if target_k not in avg:
        raise RuntimeError(f"TARGET_CONTRACT_MISSING:{target.isoformat()}")

    anchor = _next_month(target_k)
    for _ in range(18):
        if anchor in avg and anchor not in by_month:
            break
        anchor = _next_month(anchor)
    else:
        raise RuntimeError("NO_NON_FOMC_ANCHOR")

    # Non-FOMC anchor avg rate = prior month end rate.
    known_end = float(avg[anchor])
    cur = _prev_month(anchor)
    details = {}
    while cur >= target_k:
        if cur not in avg:
            raise RuntimeError(f"CONTRACT_MISSING:{cur}")
        meeting = by_month.get(cur)
        if meeting is None:
            # We reached another non-meeting month before target; its own avg is
            # the exact bridge value under the CME anchor convention.
            known_end = float(avg[cur])
            cur = _prev_month(cur)
            continue
        days = _calendar.monthrange(meeting.year, meeting.month)[1]
        n_before = meeting.day
        n_after = days - n_before
        if n_after <= 0:
            start_rate = float(avg[cur])
        else:
            start_rate = (float(avg[cur]) * days - n_after * known_end) / n_before
        details[cur] = {
            "start_rate": start_rate,
            "end_rate": known_end,
            "avg_rate": float(avg[cur]),
            "expected_change_pct": known_end - start_rate,
            "meeting_date": meeting.isoformat(),
            "days_before_including_meeting": n_before,
            "days_after": n_after,
            "anchor_month": f"{anchor[0]:04d}-{anchor[1]:02d}",
        }
        known_end = start_rate
        cur = _prev_month(cur)

    if target_k not in details:
        raise RuntimeError("TARGET_CHANGE_NOT_DERIVED")
    return details[target_k]


def _move_distribution(change_pct: float) -> list[dict]:
    expected_moves = change_pct / 0.25
    floor_moves = math.floor(expected_moves)
    frac = expected_moves - floor_moves
    probs = [
        (int(floor_moves), max(0.0, min(1.0, 1.0 - frac))),
        (int(floor_moves + 1), max(0.0, min(1.0, frac))),
    ]
    merged: dict[int, float] = {}
    for moves, p in probs:
        if p < 0.0005:
            continue
        merged[moves] = merged.get(moves, 0.0) + p
    return [
        {"move_count_25bp": m, "move_bp": m * 25, "probability": round(p, 6)}
        for m, p in sorted(merged.items())
    ]


def _target_label(lower: float, upper: float) -> str:
    return f"{lower:.2f}-{upper:.2f}"


def _outcomes_for_next(distribution: list[dict], current_lower: float, current_upper: float) -> list[dict]:
    out = []
    for x in distribution:
        moves = int(x["move_count_25bp"])
        lo = current_lower + moves * 0.25
        hi = current_upper + moves * 0.25
        if moves == 0:
            action = "HOLD"
        elif moves > 0:
            action = f"HIKE_{moves * 25}BP"
        else:
            action = f"CUT_{abs(moves) * 25}BP"
        out.append(
            {
                "action": action,
                "move_bp": moves * 25,
                "target": _target_label(lo, hi),
                "probability": float(x["probability"]),
            }
        )
    return out


def _summary(outcomes: list[dict]) -> dict:
    hold = sum(x["probability"] for x in outcomes if x["move_bp"] == 0)
    hike = sum(x["probability"] for x in outcomes if x["move_bp"] > 0)
    cut = sum(x["probability"] for x in outcomes if x["move_bp"] < 0)
    hike25 = sum(x["probability"] for x in outcomes if x["move_bp"] == 25)
    cut25 = sum(x["probability"] for x in outcomes if x["move_bp"] == -25)
    return {
        "hold_probability": round(hold, 6),
        "hike_any_probability": round(hike, 6),
        "hike_25bp_probability": round(hike25, 6),
        "cut_any_probability": round(cut, 6),
        "cut_25bp_probability": round(cut25, 6),
    }


def _snapshot_for_date(
    trade_date: date,
    target: date,
    meetings: list[date],
    current_lower: float,
    current_upper: float,
) -> dict | None:
    try:
        settlements, used = _fetch_settlements_exact(trade_date)
        ch = _meeting_expected_change(target, settlements, meetings)
        dist = _move_distribution(ch["expected_change_pct"])
        outcomes = _outcomes_for_next(dist, current_lower, current_upper)
        s = _summary(outcomes)
        return {"trade_date": used.isoformat(), **s}
    except Exception:
        return None


def _history(
    latest_trade_date: date,
    target: date,
    meetings: list[date],
    current_lower: float,
    current_upper: float,
) -> list[dict]:
    rows = []
    d = latest_trade_date
    seen = set()
    for _ in range(14):
        if d.weekday() < 5 and d not in seen:
            snap = _snapshot_for_date(d, target, meetings, current_lower, current_upper)
            seen.add(d)
            if snap:
                rows.append(snap)
                if len(rows) >= 8:
                    break
        d -= timedelta(days=1)
    return sorted(rows, key=lambda x: x["trade_date"])


def _nearest_history(history: list[dict], target_date: date) -> dict | None:
    candidates = [x for x in history if date.fromisoformat(x["trade_date"]) <= target_date]
    return candidates[-1] if candidates else None


def main() -> None:
    now_kst = datetime.now(KST)
    now_et = now_kst.astimezone(ET)
    meetings = _load_fomc_meetings()
    upcoming = [d for d in meetings if d >= now_et.date()]
    if not upcoming:
        raise SystemExit("FEDWATCH_NO_UPCOMING_FOMC")
    next_meeting = upcoming[0]

    effr, effr_date = _fred_latest("EFFR")
    lower, lower_date = _fred_latest("DFEDTARL")
    upper, upper_date = _fred_latest("DFEDTARU")

    expected_trade_date = _expected_latest_trade_date(now_et)
    settlements, trade_date = _fetch_latest_settlements(expected_trade_date)
    change = _meeting_expected_change(next_meeting, settlements, meetings)
    distribution = _move_distribution(change["expected_change_pct"])
    outcomes = _outcomes_for_next(distribution, lower, upper)
    summary = _summary(outcomes)

    history = _history(trade_date, next_meeting, meetings, lower, upper)
    cur = next((x for x in history if x["trade_date"] == trade_date.isoformat()), None)
    if cur is None:
        cur = {"trade_date": trade_date.isoformat(), **summary}
        history.append(cur)
        history.sort(key=lambda x: x["trade_date"])
    one_day = _nearest_history(history, trade_date - timedelta(days=1))
    one_week = _nearest_history(history, trade_date - timedelta(days=7))

    def delta(ref: dict | None) -> float | None:
        if not ref:
            return None
        return round((summary["hike_any_probability"] - ref["hike_any_probability"]) * 100.0, 2)

    gap_days = (expected_trade_date - trade_date).days
    freshness = "LIVE" if gap_days <= 1 else "STALE"
    quality_state = "PASS" if freshness == "LIVE" else "DEGRADED"

    out = {
        "schema": "JJOONI_FED_WATCH_V1",
        "generated_kst": now_kst.isoformat(timespec="seconds"),
        "read_only": True,
        "contains_account_data": False,
        "source": "CME Fed Funds futures settlement-derived FedWatch probability",
        "source_priority": "CME_PRIMARY",
        "calculation_contract": "CME_FEDWATCH_ANCHOR_MONTH_METHODOLOGY_NEAREST_NODE_V1",
        "official_api_status": "NOT_CONFIGURED_SETTLEMENT_DERIVED",
        "meeting_date": next_meeting.isoformat(),
        "market_data_as_of": trade_date.isoformat(),
        "expected_market_data_date": expected_trade_date.isoformat(),
        "observed_at": now_kst.isoformat(timespec="seconds"),
        "freshness": freshness,
        "current_target": _target_label(lower, upper),
        "current_target_lower": lower,
        "current_target_upper": upper,
        "effr": effr,
        "effr_date": effr_date,
        "outcomes": outcomes,
        **summary,
        "change_1d_pctpt": delta(one_day),
        "change_1w_pctpt": delta(one_week),
        "history": history,
        "calculation": {
            "start_effr_implied": round(change["start_rate"], 6),
            "end_effr_implied": round(change["end_rate"], 6),
            "meeting_month_avg_effr": round(change["avg_rate"], 6),
            "expected_change_bp": round(change["expected_change_pct"] * 100.0, 3),
            "anchor_month": change["anchor_month"],
            "days_before_including_meeting": change["days_before_including_meeting"],
            "days_after": change["days_after"],
        },
        "quality": {
            "state": quality_state,
            "cme_trade_date_gap_days": gap_days,
            "fred_target_dates": {"lower": lower_date, "upper": upper_date, "effr": effr_date},
            "history_points": len(history),
        },
        "provenance": {
            "cme_settlements": CME_SETTLEMENTS_URL,
            "cme_methodology": "https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html",
            "fred": FRED_CSV,
        },
        "usage_contract": {
            "strategy_usable": freshness == "LIVE",
            "stale_rule": "If freshness != LIVE, do not use probability as a strategy fact; refresh CME source or web-verify CME FedWatch.",
            "attribution": "CME FedWatch-compatible probability derived from CME 30-Day Fed Funds settlements; not the paid CME FedWatch API payload.",
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("FED_WATCH_BUILD=PASS")
    print("meeting=", out["meeting_date"])
    print("market_data_as_of=", out["market_data_as_of"])
    print("hike_any_probability=", out["hike_any_probability"])
    print("hold_probability=", out["hold_probability"])
    print("change_1d_pctpt=", out["change_1d_pctpt"])
    print("change_1w_pctpt=", out["change_1w_pctpt"])
    print("freshness=", out["freshness"])


if __name__ == "__main__":
    main()
