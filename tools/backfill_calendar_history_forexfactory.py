#!/usr/bin/env python3
"""Backfill up to ten years of economic-calendar history from Forex Factory.

This is a historical market-data supplement, not the calendar authority. It
never overwrites a captured OFFICIAL actual. Canonical event/metric families are
matched first; unmatched market rows are retained in generic history buckets so
PB/analyst consumers can inspect the full source history. Backfill progress is
published even when a small number of weeks fail, and failed weeks are retried
on subsequent runs until coverage becomes FULL.
"""
from __future__ import annotations

import json
import os
import re
import time as sleep_time
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from curl_cffi import requests

from enrich_calendar_all_events import text_score
from calendar_history_integrity import merge_history_observation

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
HIST = ROOT / 'market-observatory' / 'data' / 'economic-calendar-history.json'
KST = ZoneInfo('Asia/Seoul')
DEFAULT_SOURCE_TZ = ZoneInfo('Europe/London')
WINDOW_DAYS = int(os.getenv('HISTORY_WINDOW_DAYS', '3650'))
SLEEP_SECONDS = float(os.getenv('HISTORY_BACKFILL_SLEEP_SECONDS', '0.75'))
MAX_WEEKS = int(os.getenv('HISTORY_BACKFILL_MAX_WEEKS', '0'))
UA = 'Mozilla/5.0 JJOONI-Market-Observatory-History/2.0'
COUNTRY_BY_CCY = {
    'USD': 'US', 'JPY': 'JP', 'GBP': 'GB', 'EUR': 'EU', 'CAD': 'CA',
    'AUD': 'AU', 'NZD': 'NZ', 'CHF': 'CH', 'CNY': 'CN', 'RMB': 'CN',
    'KRW': 'KR',
}
MONTH = {m.lower(): i for i, m in enumerate(
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 1)}


def clean(v):
    if v is None:
        return None
    s = str(v).replace('\xa0', ' ').strip()
    return None if s in ('', '-', '—', 'None', 'null', 'N/A') else s


def slug(text):
    s = str(text or '').lower()
    s = re.sub(r'[^a-z0-9가-힣]+', '-', s).strip('-')
    return s[:160] or 'event'


def sunday_on_or_before(d: date) -> date:
    return d - timedelta(days=(d.weekday() + 1) % 7)


def week_token(d: date) -> str:
    return f"{d.strftime('%b').lower()}{d.day}.{d.year}"


def parse_source_day(text: str, year: int, fallback: date | None) -> date | None:
    s = ' '.join(str(text or '').split())
    m = re.search(r'\b([A-Za-z]{3})\s*(\d{1,2})\b', s)
    if not m:
        return fallback
    month = MONTH.get(m.group(1).lower())
    if not month:
        return fallback
    resolved_year = year
    if fallback is not None:
        if fallback.month >= 11 and month <= 2:
            resolved_year = fallback.year + 1
        elif fallback.month <= 2 and month >= 11:
            resolved_year = fallback.year - 1
        else:
            resolved_year = fallback.year
    return date(resolved_year, month, int(m.group(2)))


def detect_source_zone(soup):
    text = soup.get_text(' ', strip=True)
    match = re.search(r'Calendar\s+Time\s+Zone:\s*([A-Za-z_]+/[A-Za-z_]+)', text, re.I)
    if match:
        try:
            return ZoneInfo(match.group(1))
        except Exception:
            pass
    return DEFAULT_SOURCE_TZ


def parse_kst_datetime(day: date, clock: str, fallback_clock: str | None = None,
                       source_zone: ZoneInfo = DEFAULT_SOURCE_TZ):
    raw = ' '.join(str(clock or '').split()).lower()
    if not raw:
        raw = str(fallback_clock or '').strip().lower()
    if not raw or raw in ('all day', 'tentative') or raw.startswith('day '):
        return datetime.combine(day, time(12, 0), source_zone).astimezone(KST), raw
    try:
        t = datetime.strptime(raw.replace(' ', ''), '%I:%M%p').time()
    except ValueError:
        return datetime.combine(day, time(12, 0), source_zone).astimezone(KST), raw
    return datetime.combine(day, t, source_zone).astimezone(KST), raw


def cell_text(row, name):
    cell = row.select_one(f'td.calendar__cell.calendar__{name}.{name}') or row.select_one(f'td.{name}')
    return clean(cell.get_text(' ', strip=True)) if cell else None


def parse_page(html: str, year: int):
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.select_one('table.calendar__table')
    if table is None:
        raise ValueError('ForexFactory calendar table missing')
    source_zone = detect_source_zone(soup)
    rows = table.select('tr.calendar__row')
    out = []
    current_day = None
    current_clock = None
    for row in rows:
        if 'calendar__expand' in (row.get('class') or []):
            continue
        date_text = cell_text(row, 'date')
        current_day = parse_source_day(date_text or '', year, current_day)
        if current_day is None:
            continue
        clock = cell_text(row, 'time')
        if clock:
            current_clock = clock
        currency = (cell_text(row, 'currency') or '').upper()
        country = COUNTRY_BY_CCY.get(currency)
        if not country:
            continue
        title = cell_text(row, 'event')
        if not title:
            continue
        actual = cell_text(row, 'actual')
        forecast = cell_text(row, 'forecast')
        previous = cell_text(row, 'previous')
        if not any((actual, forecast, previous)):
            continue
        kst_dt, source_clock = parse_kst_datetime(
            current_day, clock or '', current_clock, source_zone=source_zone)
        out.append({
            'source_date': current_day.isoformat(),
            'source_time': source_clock,
            'source_timezone': str(source_zone),
            'datetime_kst': kst_dt.isoformat(timespec='minutes'),
            'date': kst_dt.date().isoformat(),
            'country': country,
            'currency': currency,
            'title': title,
            'actual': actual,
            'consensus': forecast,
            'previous': previous,
            'source': 'ForexFactory historical calendar',
            'source_tier': 'MARKET_FEED',
        })
    return out


def fetch_week(start: date):
    url = f'https://www.forexfactory.com/calendar?week={week_token(start)}'
    response = requests.get(
        url,
        headers={'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'},
        impersonate='chrome',
        timeout=30,
    )
    response.raise_for_status()
    text = response.text
    if 'calendar__table' not in text:
        raise RuntimeError(f'ForexFactory calendar body unavailable for {start}')
    return url, parse_page(text, start.year)


def build_catalog(calendar):
    catalog = {'metric': [], 'event': []}
    seen = set()
    for e in calendar.get('events') or []:
        country = e.get('country')
        eref = clean(e.get('history_ref'))
        if not country or not eref:
            continue
        for m in e.get('market_metrics') or []:
            if not isinstance(m, dict) or m.get('metric_type') == 'market_probability_snapshot':
                continue
            ref = clean(m.get('history_ref'))
            label = clean(m.get('label')) or clean(m.get('key'))
            if not ref or not label or ('metric', ref) in seen:
                continue
            seen.add(('metric', ref))
            catalog['metric'].append({
                'ref': ref, 'country': country, 'label': label,
                'event_title': e.get('title'), 'metric_key': m.get('key'),
            })
        if ('event', eref) not in seen:
            seen.add(('event', eref))
            catalog['event'].append({
                'ref': eref, 'country': country, 'label': e.get('title'),
                'event_title': e.get('title'), 'metric_key': None,
            })
    return catalog


def best_catalog_match(row, catalog):
    # Exact, country-scoped aliases; never fuzzy-match ADP or payroll levels.
    normalized = re.sub(r'[^a-z0-9]+', ' ', row['title'].lower()).strip()
    if row['country'] == 'US' and normalized in ('non farm employment change', 'nonfarm payrolls', 'non farm payrolls'):
        matches = [item for item in catalog['metric'] if item['country'] == 'US' and item.get('metric_key') == 'nfp']
        if len(matches) == 1:
            return {'score': 100.0, 'kind': 'metric', 'canonical': True, **matches[0]}
    candidates = []
    for kind in ('metric', 'event'):
        for item in catalog[kind]:
            if item['country'] != row['country']:
                continue
            score = text_score(row['title'], item['label'])
            if kind == 'metric':
                score += 5.0
            candidates.append((score, kind, item))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    score, kind, item = candidates[0]
    threshold = 56.0 if kind == 'metric' else 62.0
    if score < threshold:
        return None
    if len(candidates) > 1:
        runner = candidates[1]
        if runner[2]['ref'] != item['ref'] and runner[0] >= score - 2.0:
            return None
    return {'score': round(score, 2), 'kind': kind, 'canonical': True, **item}


def generic_match(row):
    label = clean(row.get('title')) or 'Economic event'
    country = row.get('country') or 'XX'
    return {
        'score': None,
        'kind': 'event',
        'canonical': False,
        'ref': f"FF::{country}::{slug(label)}",
        'country': country,
        'label': label,
        'event_title': label,
        'metric_key': None,
    }


def merge_history_row(bucket, incoming):
    rows = bucket.setdefault('rows', [])
    key = (incoming.get('date'), incoming.get('metric_key'))
    idx = next((i for i, r in enumerate(rows)
                if (r.get('date'), r.get('metric_key')) == key), None)
    if idx is None:
        rows.append(incoming)
        return 'insert'
    old = rows[idx]
    supplement = {k: v for k, v in incoming.items() if k not in ('actual', 'previous', 'consensus')}
    for field in ('actual', 'previous', 'consensus'):
        if clean(old.get(field)) is None:
            supplement[field] = incoming.get(field)
    merged = merge_history_observation(old, supplement)
    merged.setdefault('historical_market_source', incoming.get('source'))
    merged.setdefault('historical_source_date', incoming.get('source_date'))
    rows[idx] = merged
    return 'merge'


def target_weeks(window_start: date, available_from: str | None, failed_weeks=None, recent_completed=None):
    retries = []
    for raw in failed_weeks or []:
        try:
            retries.append(datetime.fromisoformat(str(raw)[:10]).date())
        except ValueError:
            pass
    if available_from:
        try:
            stop = datetime.fromisoformat(str(available_from)[:10]).date() - timedelta(days=1)
        except ValueError:
            stop = date.today()
    else:
        stop = date.today()
    weeks = []
    if stop >= window_start:
        cursor = sunday_on_or_before(window_start)
        last = sunday_on_or_before(stop)
        while cursor <= last:
            weeks.append(cursor)
            cursor += timedelta(days=7)
    for week in retries:
        week = sunday_on_or_before(week)
        if window_start <= week <= date.today() and week not in weeks:
            weeks.append(week)
    # Repair the broad-universe recent segment separately from the old boundary.
    # Exclude current week from permanent completion: its actuals are not final.
    completed = set(recent_completed or [])
    today = datetime.now(KST).date()
    cursor = sunday_on_or_before(max(window_start, today - timedelta(days=385)))
    last = sunday_on_or_before(today)
    while cursor <= last:
        if cursor.isoformat() not in completed:
            weeks.append(cursor)
        cursor += timedelta(days=7)
    weeks = sorted(set(weeks))
    if MAX_WEEKS > 0:
        # Prefer the newest missing segment so usable coverage expands backward
        # contiguously from the existing archive.
        weeks = weeks[-MAX_WEEKS:]
    return weeks


def main():
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    history = json.loads(HIST.read_text(encoding='utf-8'))
    today = datetime.now(KST).date()
    window_start = today - timedelta(days=WINDOW_DAYS)
    available_from = history.get('available_from')
    old_backfill = history.get('backfill') or {}
    weeks = target_weeks(window_start, available_from, old_backfill.get('failed_weeks'), old_backfill.get('recent_completed_weeks'))
    if not weeks:
        history['backfill_status'] = 'COMPLETE' if history.get('coverage_status') == 'FULL' else 'NOOP_NO_TARGET_WEEKS'
        history['backfill_checked_kst'] = datetime.now(KST).isoformat(timespec='seconds')
        HIST.write_text(json.dumps(history, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('CALENDAR_HISTORY_FF_BACKFILL=NOOP available_from=', available_from,
              'coverage=', history.get('coverage_status'))
        return

    catalog = build_catalog(calendar)
    series = history.setdefault('series', {})
    fetched = parsed = canonical_matched = generic_retained = inserted = merged = 0
    sources = []
    fetched_week_ids = set()
    errors = []
    completed = set(old_backfill.get('recent_completed_weeks') or [])

    for i, week in enumerate(weeks):
        try:
            url, rows = fetch_week(week)
            fetched += 1
            fetched_week_ids.add(week.isoformat())
            parsed += len(rows)
            sources.append(url)
            if week < sunday_on_or_before(today):
                completed.add(week.isoformat())
            for row in rows:
                row_day = datetime.fromisoformat(row['date']).date()
                if row_day < window_start or row_day > today:
                    continue
                match = best_catalog_match(row, catalog)
                if match:
                    canonical_matched += 1
                else:
                    match = generic_match(row)
                    generic_retained += 1
                ref = match['ref']
                bucket = series.setdefault(ref, {
                    'ref': ref,
                    'country': match['country'],
                    'event_title': match.get('event_title'),
                    'label': match.get('label'),
                    'metric_key': match.get('metric_key'),
                    'kind': match['kind'],
                    'category': None,
                    'canonical': bool(match.get('canonical')),
                    'rows': [],
                })
                payload = {
                    'date': row['date'],
                    'datetime_kst': row['datetime_kst'],
                    'reference_period': None,
                    'previous': row.get('previous'),
                    'consensus': row.get('consensus'),
                    'actual': row.get('actual'),
                    'te_forecast': None,
                    'surprise': None,
                    'source': row.get('source'),
                    'source_tier': 'MARKET_FEED',
                    'verification_status': 'HISTORICAL_MARKET_REPORTED',
                    'value_vintage': 'BACKFILLED_VINTAGE_UNVERIFIED',
                    'metric_key': match.get('metric_key'),
                    'label': match.get('label'),
                    'source_date': row.get('source_date'),
                    'source_time': row.get('source_time'),
                    'source_timezone': row.get('source_timezone'),
                    'match_score': match.get('score'),
                    'canonical_match': bool(match.get('canonical')),
                }
                action = merge_history_row(bucket, payload)
                inserted += int(action == 'insert')
                merged += int(action == 'merge')
        except Exception as exc:
            errors.append({'week': week.isoformat(), 'error': f'{type(exc).__name__}: {exc}'})
        if i + 1 < len(weeks) and SLEEP_SECONDS > 0:
            sleep_time.sleep(SLEEP_SECONDS)

    earliest = None
    latest = None
    total_rows = 0
    for bucket in series.values():
        bucket['rows'].sort(key=lambda x: (str(x.get('date') or ''), str(x.get('datetime_kst') or '')))
        bucket['count'] = len(bucket['rows'])
        bucket['available_from'] = bucket['rows'][0]['date'] if bucket['rows'] else None
        bucket['available_to'] = bucket['rows'][-1]['date'] if bucket['rows'] else None
        total_rows += bucket['count']
        if bucket['available_from']:
            earliest = min(earliest, bucket['available_from']) if earliest else bucket['available_from']
        if bucket['available_to']:
            latest = max(latest, bucket['available_to']) if latest else bucket['available_to']

    failed_weeks = sorted((set(old_backfill.get('failed_weeks') or []) - fetched_week_ids) | {x['week'] for x in errors})
    early_enough = bool(earliest and earliest <= (window_start + timedelta(days=14)).isoformat())
    coverage = 'FULL' if early_enough and not failed_weeks else ('PARTIAL_GAPS' if early_enough else 'PARTIAL')
    history['generated_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    history['window_days'] = WINDOW_DAYS
    history['window_years'] = 10
    history['window_start'] = window_start.isoformat()
    history['window_end'] = today.isoformat()
    history['contract'] = 'ROLLING_3650D_EVENT_AND_METRIC_HISTORY_PRESERVE_V2'
    history['available_from'] = earliest
    history['available_to'] = latest
    history['series_count'] = len(series)
    history['row_count'] = total_rows
    history['coverage_status'] = coverage
    history['backfill_status'] = 'COMPLETE' if coverage == 'FULL' else ('PARTIAL_GAPS' if failed_weeks else 'IN_PROGRESS')
    history['backfill_contract'] = 'FOREXFACTORY_HISTORICAL_10Y_RESUMABLE_V2'
    history['backfill'] = {
        'recent_completed_weeks': sorted(completed),
        'coverage_scope': 'FETCHED_WEEKS_NOT_PER_SERIES_COMPLETENESS',
        'requested_window_start': window_start.isoformat(),
        'previous_available_from': available_from,
        'weeks_requested': len(weeks),
        'weeks_fetched': fetched,
        'rows_parsed': parsed,
        'canonical_rows_matched': canonical_matched,
        'generic_rows_retained': generic_retained,
        'rows_inserted': inserted,
        'rows_merged': merged,
        'failed_weeks': failed_weeks,
        'errors': errors,
        'source_count': len(sources),
        'source_pattern': 'https://www.forexfactory.com/calendar?week=<week>',
        'checked_kst': datetime.now(KST).isoformat(timespec='seconds'),
        'resumable': True,
    }
    HIST.write_text(json.dumps(history, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_HISTORY_FF_BACKFILL=PASS weeks=', fetched, '/', len(weeks),
          'parsed=', parsed, 'canonical=', canonical_matched, 'generic=', generic_retained,
          'inserted=', inserted, 'merged=', merged, 'coverage=', coverage,
          'available_from=', earliest, 'failed_weeks=', len(failed_weeks))
    if fetched == 0 and weeks:
        raise SystemExit('CALENDAR_HISTORY_FF_BACKFILL=FAIL no weekly page could be fetched')


if __name__ == '__main__':
    main()

