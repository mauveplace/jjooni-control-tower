#!/usr/bin/env python3
"""Current-DOM adapter for long-horizon ForexFactory calendar backfill.

ForexFactory serves more than one calendar markup variant depending on request
profile. This adapter accepts table-row, responsive div-row, data-eventid, and
class-token variants. Weekly requests are retried with bounded backoff; matching,
source precedence, resumable progress and coverage state remain owned by the
legacy backfill module.
"""
from __future__ import annotations

import time
from bs4 import BeautifulSoup
from curl_cffi import requests

import backfill_calendar_history_forexfactory as legacy


def _classes(tag):
    return set(tag.get('class') or []) if tag else set()


def _text(tag):
    return legacy.clean(tag.get_text(' ', strip=True)) if tag else None


def flexible_cell(row, name):
    selectors = [
        f'.calendar__{name}',
        f'.calendar-{name}',
        f'.{name}',
        f'[data-field="{name}"]',
        f'[data-name="{name}"]',
        f'[data-column="{name}"]',
    ]
    for selector in selectors:
        try:
            cell = row.select_one(selector)
        except Exception:
            cell = None
        value = _text(cell)
        if value is not None:
            return value
    for node in row.find_all(True):
        cls = ' '.join(node.get('class') or []).lower()
        if name.lower() in cls:
            value = _text(node)
            if value is not None:
                return value
    return None


def candidate_rows(soup):
    table = soup.select_one('.calendar__table') or soup.select_one('[class*="calendar__table"]') or soup
    selectors = [
        'tr.calendar__row',
        'tr.calendar_row',
        'tr[data-eventid]',
        '[data-eventid]',
        '.calendar__row',
        '.calendar_row',
    ]
    out = []
    seen = set()
    for selector in selectors:
        try:
            found = table.select(selector)
        except Exception:
            found = []
        for row in found:
            ident = id(row)
            if ident in seen:
                continue
            seen.add(ident)
            out.append(row)
    if not out:
        for row in table.find_all(['tr', 'div', 'li'], recursive=True):
            currency = flexible_cell(row, 'currency')
            title = flexible_cell(row, 'event')
            if currency and title:
                ident = id(row)
                if ident not in seen:
                    seen.add(ident)
                    out.append(row)
    return out


def parse_page(html: str, year: int):
    soup = BeautifulSoup(html, 'html.parser')
    if soup.select_one('.calendar__table') is None and soup.select_one('[class*="calendar__table"]') is None:
        raise ValueError('ForexFactory calendar table missing')
    source_zone = legacy.detect_source_zone(soup)
    rows = candidate_rows(soup)
    out = []
    current_day = None
    current_clock = None
    for row in rows:
        classes = _classes(row)
        if any('expand' in c.lower() for c in classes):
            continue
        date_text = flexible_cell(row, 'date')
        current_day = legacy.parse_source_day(date_text or '', year, current_day)
        if current_day is None:
            continue
        clock = flexible_cell(row, 'time')
        if clock:
            current_clock = clock
        currency = (flexible_cell(row, 'currency') or '').upper()
        country = legacy.COUNTRY_BY_CCY.get(currency)
        if not country:
            continue
        title = flexible_cell(row, 'event')
        if not title:
            continue
        actual = flexible_cell(row, 'actual')
        forecast = flexible_cell(row, 'forecast')
        previous = flexible_cell(row, 'previous')
        if not any((actual, forecast, previous)):
            continue
        kst_dt, source_clock = legacy.parse_kst_datetime(
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


def _once(start):
    url = f'https://www.forexfactory.com/calendar?week={legacy.week_token(start)}'
    response = requests.get(
        url,
        headers={'User-Agent': legacy.UA, 'Accept-Language': 'en-US,en;q=0.9'},
        impersonate='chrome',
        timeout=30,
    )
    response.raise_for_status()
    text = response.text
    if 'calendar__table' not in text and 'calendar' not in text.lower():
        raise RuntimeError(f'ForexFactory calendar body unavailable for {start}')
    rows = parse_page(text, start.year)
    if not rows:
        soup = BeautifulSoup(text, 'html.parser')
        candidates = candidate_rows(soup)
        sample = []
        for row in candidates[:5]:
            sample.append({
                'tag': row.name,
                'class': row.get('class'),
                'currency': flexible_cell(row, 'currency'),
                'event': flexible_cell(row, 'event'),
                'actual': flexible_cell(row, 'actual'),
                'forecast': flexible_cell(row, 'forecast'),
                'previous': flexible_cell(row, 'previous'),
            })
        raise RuntimeError(
            f'ForexFactory historical rows unparsed week={start} '
            f'candidate_rows={len(candidates)} samples={sample}')
    return url, rows


def fetch_week(start):
    last = None
    for attempt, delay in enumerate((0, 2, 6), 1):
        if delay:
            time.sleep(delay)
        try:
            return _once(start)
        except Exception as exc:
            last = exc
            if attempt == 3:
                break
    raise RuntimeError(f'ForexFactory week fetch failed after 3 attempts week={start}: {last}')


def main():
    legacy.parse_page = parse_page
    legacy.fetch_week = fetch_week
    legacy.main()


if __name__ == '__main__':
    main()
