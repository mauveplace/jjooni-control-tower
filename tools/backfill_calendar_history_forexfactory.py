#!/usr/bin/env python3
"""Backfill the missing rolling-365d calendar window from Forex Factory HTML.

This is a bounded catch-up job, not a new calendar authority.  It only fills
historical Previous/Consensus/Actual fields for event/metric families already
present in the canonical JJOONI calendar and never overwrites a captured
OFFICIAL actual.  Once the requested window is covered, subsequent runs no-op.
"""
from __future__ import annotations

import json
import re
import time as sleep_time
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from curl_cffi import requests

from enrich_calendar_all_events import text_score

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
HIST = ROOT / 'market-observatory' / 'data' / 'economic-calendar-history.json'
KST = ZoneInfo('Asia/Seoul')
LONDON = ZoneInfo('Europe/London')
WINDOW_DAYS = 365
UA = 'Mozilla/5.0 JJOONI-Market-Observatory-History/1.0'
COUNTRY_BY_CCY = {'USD': 'US', 'JPY': 'JP', 'GBP': 'GB'}
MONTH = {m.lower(): i for i, m in enumerate(
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 1)}


def clean(v):
    if v is None:
        return None
    s = str(v).replace('\xa0', ' ').strip()
    return None if s in ('', '-', '—', 'None', 'null', 'N/A') else s


def sunday_on_or_before(d: date) -> date:
    # Python Monday=0 ... Sunday=6.
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
    return date(year, month, int(m.group(2)))


def parse_kst_datetime(day: date, clock: str, fallback_clock: str | None = None):
    raw = ' '.join(str(clock or '').split()).lower()
    if not raw:
        raw = str(fallback_clock or '').strip().lower()
    if not raw or raw in ('all day', 'tentative') or raw.startswith('day '):
        return datetime.combine(day, time(12, 0), LONDON).astimezone(KST), raw
    try:
        t = datetime.strptime(raw.replace(' ', ''), '%I:%M%p').time()
    except ValueError:
        return datetime.combine(day, time(12, 0), LONDON).astimezone(KST), raw
    return datetime.combine(day, t, LONDON).astimezone(KST), raw


def cell_text(row, name):
    cell = row.select_one(f'td.calendar__cell.calendar__{name}.{name}') or row.select_one(f'td.{name}')
    return clean(cell.get_text(' ', strip=True)) if cell else None


def parse_page(html: str, year: int):
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.select_one('table.calendar__table')
    if table is None:
        raise ValueError('ForexFactory calendar table missing')
    rows = table.select('tr.calendar__row')
    out = []
    current_day = None
    current_clock = None
    for row in rows:
        # Exclude expandable detail rows which use the same base class.
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
        kst_dt, source_clock = parse_kst_datetime(current_day, clock or '', current_clock)
        out.append({
            'source_date': current_day.isoformat(),
            'source_time': source_clock,
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
        if country not in ('US','JP','GB') or not eref:
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
    candidates = []
    for kind in ('metric', 'event'):
        for item in catalog[kind]:
            if item['country'] != row['country']:
                continue
            score = text_score(row['title'], item['label'])
            # Metric rows are preferred because they preserve granular history.
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
    # Reject ambiguous matches when the runner-up is almost identical and points
    # to another family. This is safer than forcing historical data into a wrong
    # metric simply to increase coverage.
    if len(candidates) > 1:
        runner = candidates[1]
        if runner[2]['ref'] != item['ref'] and runner[0] >= score - 2.0:
            return None
    return {'score': round(score, 2), 'kind': kind, **item}


def merge_history_row(bucket, incoming):
    rows = bucket.setdefault('rows', [])
    key = (incoming.get('date'), incoming.get('metric_key'))
    idx = next((i for i, r in enumerate(rows)
                if (r.get('date'), r.get('metric_key')) == key), None)
    if idx is None:
        rows.append(incoming)
        return 'insert'
    old = rows[idx]
    merged = dict(old)
    # Historical market feed is useful for Previous/Consensus.  It may fill an
    # Actual only when no captured actual exists; an OFFICIAL actual is immutable.
    for field in ('previous','consensus'):
        if clean(merged.get(field)) is None and clean(incoming.get(field)) is not None:
            merged[field] = incoming[field]
            merged[f'{field}_source'] = incoming.get('source')
    if clean(merged.get('actual')) is None and clean(incoming.get('actual')) is not None:
        merged['actual'] = incoming['actual']
        merged['actual_source'] = incoming.get('source')
        if clean(merged.get('source')) is None:
            merged['source'] = incoming.get('source')
            merged['source_tier'] = incoming.get('source_tier')
    merged.setdefault('historical_market_source', incoming.get('source'))
    merged.setdefault('historical_source_date', incoming.get('source_date'))
    rows[idx] = merged
    return 'merge'


def target_weeks(window_start: date, available_from: str | None):
    if available_from:
        try:
            stop = datetime.fromisoformat(str(available_from)[:10]).date() - timedelta(days=1)
        except ValueError:
            stop = date.today()
    else:
        stop = date.today()
    if stop < window_start:
        return []
    start = sunday_on_or_before(window_start)
    last = sunday_on_or_before(stop)
    weeks = []
    cursor = start
    while cursor <= last:
        weeks.append(cursor)
        cursor += timedelta(days=7)
    return weeks


def main():
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    history = json.loads(HIST.read_text(encoding='utf-8'))
    today = datetime.now(KST).date()
    window_start = today - timedelta(days=WINDOW_DAYS)
    available_from = history.get('available_from')
    weeks = target_weeks(window_start, available_from)
    if not weeks:
        history['backfill_status'] = 'NOOP_WINDOW_ALREADY_COVERED'
        history['backfill_checked_kst'] = datetime.now(KST).isoformat(timespec='seconds')
        HIST.write_text(json.dumps(history, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('CALENDAR_HISTORY_FF_BACKFILL=NOOP available_from=', available_from)
        return

    catalog = build_catalog(calendar)
    series = history.setdefault('series', {})
    fetched = parsed = matched = inserted = merged = rejected = 0
    sources = []
    errors = []

    for i, week in enumerate(weeks):
        try:
            url, rows = fetch_week(week)
            fetched += 1
            parsed += len(rows)
            sources.append(url)
            for row in rows:
                # Keep only the requested rolling window and only the currently
                # missing segment. The current production archive owns later dates.
                row_day = datetime.fromisoformat(row['date']).date()
                if row_day < window_start:
                    continue
                if available_from and row['date'] >= str(available_from)[:10]:
                    continue
                match = best_catalog_match(row, catalog)
                if not match:
                    rejected += 1
                    continue
                matched += 1
                ref = match['ref']
                bucket = series.setdefault(ref, {
                    'ref': ref,
                    'country': match['country'],
                    'event_title': match.get('event_title'),
                    'label': match.get('label'),
                    'metric_key': match.get('metric_key'),
                    'kind': match['kind'],
                    'category': None,
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
                    'metric_key': match.get('metric_key'),
                    'label': match.get('label'),
                    'source_date': row.get('source_date'),
                    'source_time': row.get('source_time'),
                    'match_score': match['score'],
                }
                action = merge_history_row(bucket, payload)
                inserted += int(action == 'insert')
                merged += int(action == 'merge')
        except Exception as exc:
            errors.append({'week': week.isoformat(), 'error': f'{type(exc).__name__}: {exc}'})
        if i + 1 < len(weeks):
            sleep_time.sleep(1.0)

    if fetched == 0:
        raise SystemExit(f'CALENDAR_HISTORY_FF_BACKFILL=FAIL no historical week fetched errors={errors}')

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

    history['generated_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    history['available_from'] = earliest
    history['available_to'] = latest
    history['series_count'] = len(series)
    history['row_count'] = total_rows
    history['coverage_status'] = 'FULL' if earliest and earliest <= (window_start + timedelta(days=14)).isoformat() else 'PARTIAL'
    history['backfill_status'] = 'PASS_WITH_WARNINGS' if errors else 'PASS'
    history['backfill_contract'] = 'FOREXFACTORY_HISTORICAL_MISSING_WINDOW_ONLY_V1'
    history['backfill'] = {
        'requested_window_start': window_start.isoformat(),
        'previous_available_from': available_from,
        'weeks_requested': len(weeks),
        'weeks_fetched': fetched,
        'rows_parsed': parsed,
        'rows_matched': matched,
        'rows_inserted': inserted,
        'rows_merged': merged,
        'rows_rejected': rejected,
        'errors': errors,
        'source_count': len(sources),
        'source_pattern': 'https://www.forexfactory.com/calendar?week=<week>',
        'checked_kst': datetime.now(KST).isoformat(timespec='seconds'),
    }
    HIST.write_text(json.dumps(history, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_HISTORY_FF_BACKFILL=PASS weeks=', fetched, '/', len(weeks),
          'parsed=', parsed, 'matched=', matched, 'inserted=', inserted,
          'merged=', merged, 'rejected=', rejected, 'coverage=', history['coverage_status'],
          'available_from=', earliest, 'errors=', len(errors))


if __name__ == '__main__':
    main()
