#!/usr/bin/env python3
"""Stdlib-only CME Fed Funds expected-settlement calendar helpers.

Kept dependency-free so read-only audits can evaluate FedWatch freshness without
importing the network collector stack (curl_cffi, etc.).
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    d = date(year, month, 1)
    return d + timedelta(days=(weekday - d.weekday()) % 7 + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    if month == 12:
        d = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        d = date(year, month + 1, 1) - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def _observed_fixed(d: date) -> date:
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def _easter_sunday(year: int) -> date:
    # Gregorian computus.
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
