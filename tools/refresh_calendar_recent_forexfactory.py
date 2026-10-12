#!/usr/bin/env python3
"""Recover recent overdue calendar actuals from ForexFactory historical weeks.

The routine weekly JSON feed rolls off quickly.  This bridge reuses the existing
10Y ForexFactory browser-compatible fetcher for only the weeks that contain
currently overdue events, then feeds those rows through the same generic
country/date/title matcher used by the canonical calendar enricher.

Safety contract:
- market-feed observations only fill/refresh data at MARKET_FEED rank;
- OFFICIAL/SECONDARY observations cannot be downgraded (merge_observation owns
  precedence);
- missing values are never invented;
- fetch failures remain observable and do not erase existing facts.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from backfill_calendar_history_forexfactory import sunday_on_or_before
from backfill_calendar_history_forexfactory_v2 import fetch_week
from calendar_actual_contract import build_freshness
from enrich_calendar_all_events import apply_all_event_enrichment

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory/data/economic-calendar.json'
KST = ZoneInfo('Asia/Seoul')
MAX_LOOKBACK_DAYS = 120
MAX_WEEKS_PER_RUN = 16


def overdue_dates(calendar: dict, now: datetime) -> list[str]:
    health = build_freshness(calendar, now, (calendar.get('actual_freshness') or {}).get('official_checks') or [])
    out = []
    cutoff = (now.date() - timedelta(days=MAX_LOOKBACK_DAYS)).isoformat()
    for row in health.get('overdue_events') or []:
        day = str(row.get('datetime_kst') or '')[:10]
        if day and day >= cutoff:
            out.append(day)
    return sorted(set(out))


def target_weeks(days: list[str]) -> list:
    weeks = set()
    for raw in days:
        try:
            d = datetime.fromisoformat(raw).date()
        except ValueError:
            continue
        weeks.add(sunday_on_or_before(d))
    return sorted(weeks)[-MAX_WEEKS_PER_RUN:]


def as_faireconomy_row(row: dict, source_url: str) -> dict:
    """Map historical scraper output to the canonical FF normalization schema."""
    return {
        'country': row.get('currency'),
        'date': row.get('datetime_kst') or row.get('date'),
        'title': row.get('title'),
        'actual': row.get('actual'),
        'forecast': row.get('consensus'),
        'previous': row.get('previous'),
        '_source_url': source_url,
    }


def recover(calendar: dict, now: datetime | None = None, fetcher=fetch_week) -> dict:
    now = (now or datetime.now(KST)).astimezone(KST)
    before = build_freshness(calendar, now, (calendar.get('actual_freshness') or {}).get('official_checks') or [])
    days = overdue_dates(calendar, now)
    weeks = target_weeks(days)
    vendor_rows = []
    fetched = []
    errors = []
    for week in weeks:
        try:
            url, rows = fetcher(week)
            fetched.append({'week': week.isoformat(), 'source_url': url, 'rows': len(rows)})
            vendor_rows.extend(as_faireconomy_row(row, url) for row in rows)
        except Exception as exc:
            errors.append({'week': week.isoformat(), 'error': type(exc).__name__, 'detail': str(exc)[:300]})

    stats = apply_all_event_enrichment(calendar, [], vendor_rows, now) if vendor_rows else {
        'eligible_events': 0, 'matched_events': 0, 'matched_metric_rows': 0,
        'field_updates': 0, 'vendor_rows': 0,
    }
    checks = (calendar.get('actual_freshness') or {}).get('official_checks') or []
    after = build_freshness(calendar, now, checks)
    calendar['actual_freshness'] = after
    calendar['recent_historical_recovery'] = {
        'schema': 'JJOONI_CALENDAR_RECENT_FF_RECOVERY_V1',
        'checked_kst': now.isoformat(timespec='seconds'),
        'lookback_days': MAX_LOOKBACK_DAYS,
        'target_overdue_dates': days,
        'target_weeks': [w.isoformat() for w in weeks],
        'fetched_weeks': fetched,
        'fetch_errors': errors,
        'vendor_rows': len(vendor_rows),
        'matched_events': stats.get('matched_events', 0),
        'matched_metric_rows': stats.get('matched_metric_rows', 0),
        'field_updates': stats.get('field_updates', 0),
        'overdue_before': int(before.get('overdue_count') or 0),
        'overdue_after': int(after.get('overdue_count') or 0),
        'contract': 'MARKET_FEED_RECOVERY_NEVER_OVERRIDES_HIGHER_TIER_ACTUALS',
    }
    return calendar['recent_historical_recovery']


def main():
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    report = recover(calendar)
    calendar['generated_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_RECENT_FF_RECOVERY=PASS',
          'weeks=', len(report['target_weeks']),
          'fetched=', len(report['fetched_weeks']),
          'rows=', report['vendor_rows'],
          'matched_events=', report['matched_events'],
          'metric_rows=', report['matched_metric_rows'],
          'field_updates=', report['field_updates'],
          'overdue=', f"{report['overdue_before']}->{report['overdue_after']}",
          'errors=', len(report['fetch_errors']))


if __name__ == '__main__':
    main()
