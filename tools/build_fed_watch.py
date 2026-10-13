#!/usr/bin/env python3
"""Compatibility entrypoint for the Observatory FedWatch V2 builder.

Historically Daily Observatory called this path directly. Keep that contract,
but delegate execution to the full conditional-meeting matrix builder. Core
settlement helpers are re-exported so existing imports continue to work.

A published snapshot is reused only when it is current for the latest expected
CME Fed Funds settlement date.  The expected date is holiday-aware so a valid
Friday settlement is not falsely marked stale on a Monday when the Fed Funds
contract is closed (for example Columbus Day).
"""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

import fedwatch_core as _core

for _name in dir(_core):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_core, _name)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    d = date(year, month, 1)
    d += timedelta(days=(weekday - d.weekday()) % 7 + 7 * (n - 1))
    return d


def _last_weekday(year: int, month: int, weekday: int) -> date:
    if month == 12:
        d = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        d = date(year, month + 1, 1) - timedelta(days=1)
    d -= timedelta(days=(d.weekday() - weekday) % 7)
    return d


def _observed_fixed(d: date) -> date:
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def _easter_sunday(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _cme_fed_funds_holidays(year: int) -> set[date]:
    holidays = {
        _observed_fixed(date(year, 1, 1)),
        _nth_weekday(year, 1, 0, 3),
        _nth_weekday(year, 2, 0, 3),
        _easter_sunday(year) - timedelta(days=2),
        _last_weekday(year, 5, 0),
        _observed_fixed(date(year, 6, 19)),
        _observed_fixed(date(year, 7, 4)),
        _nth_weekday(year, 9, 0, 1),
        _nth_weekday(year, 10, 0, 2),
        _observed_fixed(date(year, 11, 11)),
        _nth_weekday(year, 11, 3, 4),
        _observed_fixed(date(year, 12, 25)),
    }
    holidays.add(_observed_fixed(date(year + 1, 1, 1)))
    return {d for d in holidays if d.year == year}


def _is_trade_day(d: date) -> bool:
    return d.weekday() < 5 and d not in _cme_fed_funds_holidays(d.year)


def _business_day(d: date) -> date:
    while not _is_trade_day(d):
        d -= timedelta(days=1)
    return d


def _prev_business_day(d: date) -> date:
    return _business_day(d - timedelta(days=1))


def _expected_latest_trade_date(now_et: datetime) -> date:
    d = now_et.date()
    if not _is_trade_day(d):
        return _business_day(d)
    if now_et.timetz().replace(tzinfo=None) >= time(16, 30):
        return d
    return _prev_business_day(d)


def _published_snapshot_is_current(path: Path) -> tuple[bool, str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, f"READ_ERROR:{type(exc).__name__}"

    as_of = str(payload.get("market_data_as_of") or "")[:10]
    if not as_of:
        return False, "MARKET_DATA_AS_OF_MISSING"

    expected = _expected_latest_trade_date(datetime.now(_core.ET)).isoformat()
    if as_of < expected:
        return False, f"STALE:{as_of}<{expected}"

    has_distribution = bool(
        payload.get("meeting_probability_matrix")
        or payload.get("probabilities")
        or payload.get("outcomes")
    )
    if not payload.get("meeting_date") or not has_distribution:
        return False, "REQUIRED_FIELDS_MISSING"
    return True, f"CURRENT:{as_of}>={expected}"


def main() -> None:
    from build_fed_watch_v2 import main as build_v2

    existing = Path(__file__).resolve().parents[1] / "market-observatory/data/fed-watch.json"
    if existing.exists():
        current, reason = _published_snapshot_is_current(existing)
        print("FEDWATCH_COMPAT_CHECK=" + reason)
        if current:
            print("FEDWATCH=REUSE_CURRENT_DAILY_SNAPSHOT")
            return

    print("FEDWATCH=REBUILD_V2")
    build_v2()


if __name__ == "__main__":
    main()
