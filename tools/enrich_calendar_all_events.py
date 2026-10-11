#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from datetime import datetime
from pathlib import Path

from calendar_actual_contract import PROVENANCE, merge_observation
from enrich_economic_calendar import KST, clean, date_delta, ff_rows, norm, row_kst_date, te_rows

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'

COUNTRY_NAME = {
    'US': 'united states',
    'KR': 'south korea',
    'JP': 'japan',
    'GB': 'united kingdom',
}
CURRENCY = {'US': 'USD', 'KR': 'KRW', 'JP': 'JPY', 'GB': 'GBP'}

STOP = {
    'the','and','of','for','in','on','at','to','a','an','report','release','survey','index','indexes',
    'united','states','us','u','s','korea','south','japan','uk','united','kingdom','preliminary','final',
    'advance','revised','revision','estimate','estimates','monthly','quarterly','annual','data'
}

REPLACEMENTS = [
    (r'consumer price index', ' cpi '),
    (r'producer price index', ' ppi '),
    (r'personal consumption expenditures', ' pce '),
    (r'gross domestic product', ' gdp '),
    (r'non farm', ' nonfarm '),
    (r'non-farm', ' nonfarm '),
    (r'job openings and labor turnover survey', ' jolts '),
    (r'job openings and labor turnover', ' jolts '),
    (r'initial jobless claims', ' unemployment claims '),
    (r'year[ -]?over[ -]?year', ' yoy '),
    (r'year on year', ' yoy '),
    (r'y\s*/\s*y', ' yoy '),
    (r'month[ -]?over[ -]?month', ' mom '),
    (r'month on month', ' mom '),
    (r'm\s*/\s*m', ' mom '),
    (r'quarter[ -]?over[ -]?quarter', ' qoq '),
    (r'q\s*/\s*q', ' qoq '),
]


def canonical(text):
    s = str(text or '').lower()
    for pattern, repl in REPLACEMENTS:
        s = re.sub(pattern, repl, s, flags=re.I)
    s = re.sub(r'\b20\d{2}\b', ' ', s)
    s = re.sub(r'[^a-z0-9가-힣]+', ' ', s)
    return ' '.join(s.split())


def tokens(text):
    return {x for x in canonical(text).split() if len(x) > 1 and x not in STOP}


def text_score(query, candidate):
    q = canonical(query)
    c = canonical(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 100.0
    qt, ct = tokens(q), tokens(c)
    common = qt & ct
    overlap = len(common) / max(1, min(len(qt), len(ct)))
    coverage = len(common) / max(1, len(qt))
    seq = SequenceMatcher(None, q, c).ratio()
    contains = 1.0 if (q in c or c in q) else 0.0
    # Strongly reward the direction/frequency qualifiers which distinguish
    # CPI/PPI/PCE YoY from MoM rows on the same release date.
    qualifier = 0.0
    for key in ('yoy','mom','qoq','core','headline','manufacturing','services','composite'):
        q_has = key in qt
        c_has = key in ct
        if q_has == c_has and q_has:
            qualifier += 5.0
        elif q_has != c_has:
            qualifier -= 8.0
    return min(100.0, seq * 35.0 + overlap * 35.0 + coverage * 20.0 + contains * 15.0 + qualifier)


def te_country(row):
    raw = norm(row.get('Country'))
    for code, name in COUNTRY_NAME.items():
        if name in raw:
            return code
    return None


def normalized_rows():
    rows = []
    for r in te_rows():
        code = te_country(r)
        day = str(r.get('Date') or '')[:10]
        if not code or not day:
            continue
        rows.append({
            'provider': 'Trading Economics', 'source_tier': 'SECONDARY', 'country': code,
            'date': day, 'title': str(r.get('Event') or r.get('Category') or ''),
            'category': str(r.get('Category') or ''), 'previous': clean(r.get('Previous')),
            'consensus': clean(r.get('Forecast')), 'actual': clean(r.get('Actual')),
            'te_forecast': clean(r.get('TEForecast')), 'source_url': r.get('URL') or 'https://tradingeconomics.com/calendar',
        })
    for r in ff_rows():
        currency = str(r.get('country') or '').upper()
        code = next((k for k,v in CURRENCY.items() if v == currency), None)
        day = row_kst_date(r)
        if not code or not day:
            continue
        rows.append({
            'provider': 'FairEconomy/ForexFactory', 'source_tier': 'MARKET_FEED', 'country': code,
            'date': day, 'title': str(r.get('title') or ''), 'category': '',
            'previous': clean(r.get('previous')), 'consensus': clean(r.get('forecast')),
            'actual': clean(r.get('actual')), 'te_forecast': None,
            'source_url': r.get('_source_url') or 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
        })
    return rows


def event_day(event):
    return str(event.get('datetime_kst') or event.get('date') or '')[:10]


def candidates(event, rows):
    day = event_day(event)
    out = []
    for row in rows:
        if row['country'] != event.get('country'):
            continue
        delta = date_delta(day, row['date'])
        if delta > 1:
            continue
        out.append((row, 18.0 if delta == 0 else 4.0))
    return out


def best_row(query, event, rows, threshold=58.0):
    best = None
    best_score = -1.0
    for row, date_bonus in candidates(event, rows):
        score = text_score(query, row['title']) + date_bonus
        if score > best_score:
            best, best_score = row, score
    if best is None or best_score < threshold:
        return None, best_score
    return best, round(best_score, 2)


def patch_observation(target, row, now):
    before = {k: clean(target.get(k)) for k in ('previous','consensus','actual')}
    patch = {
        'previous': row.get('previous'), 'consensus': row.get('consensus'), 'actual': row.get('actual'),
        'source_tier': row.get('source_tier'), 'actual_source': row.get('provider'),
        'source_url': row.get('source_url'), 'checked_kst': now,
        'verification_status': 'MARKET_REPORTED',
    }
    merged = merge_observation(target, patch)
    target.update(merged)
    if row.get('provider'):
        target['market_value_source'] = row['provider']
    after = {k: clean(target.get(k)) for k in ('previous','consensus','actual')}
    return sum(before[k] != after[k] and after[k] is not None for k in before)


def sync_event_from_metrics(event):
    rows = [m for m in (event.get('market_metrics') or []) if isinstance(m, dict) and m.get('metric_type') != 'market_probability_snapshot']
    primary = next((m for m in rows if any(clean(m.get(k)) is not None for k in ('previous','consensus','actual'))), None)
    if not primary:
        return
    for key in ('previous','consensus'):
        if clean(primary.get(key)) is not None:
            event[key] = primary[key]
    if clean(primary.get('actual')) is not None:
        event.update(merge_observation(event, {k: primary[k] for k in ('actual', *PROVENANCE) if k in primary}))


def value_status(obj):
    if clean(obj.get('actual')) is not None:
        return 'ACTUAL_AVAILABLE'
    if clean(obj.get('consensus')) is not None:
        return 'CONSENSUS_AVAILABLE'
    if clean(obj.get('previous')) is not None:
        return 'PREVIOUS_ONLY'
    return 'NOT_PUBLISHED'


def main():
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    rows = normalized_rows()
    now = datetime.now(KST).isoformat(timespec='seconds')
    eligible = matched_events = matched_metrics = updates = 0

    for event in calendar.get('events') or []:
        country = event.get('country')
        if country not in COUNTRY_NAME:
            continue
        eligible += 1
        metrics = [m for m in (event.get('market_metrics') or []) if isinstance(m, dict)]
        metric_hits = 0
        for metric in metrics:
            if metric.get('metric_type') == 'market_probability_snapshot':
                continue
            label = metric.get('label') or metric.get('key') or event.get('title')
            query = f"{label} {event.get('title') or ''}"
            row, score = best_row(query, event, rows, threshold=57.0)
            if not row:
                # Metric titles such as CPI YoY often match more accurately without
                # the parent release title appended.
                row, score = best_row(label, event, rows, threshold=57.0)
            if row:
                updates += patch_observation(metric, row, now)
                metric['generic_match_score'] = score
                metric['market_value_status'] = value_status(metric)
                metric_hits += 1
        if metric_hits:
            matched_metrics += metric_hits
            matched_events += 1
            sync_event_from_metrics(event)
        else:
            row, score = best_row(event.get('title') or '', event, rows, threshold=60.0)
            if row:
                updates += patch_observation(event, row, now)
                event['generic_match_score'] = score
                if row.get('te_forecast') and clean(event.get('te_forecast')) is None:
                    event['te_forecast'] = row['te_forecast']
                matched_events += 1

        event['market_value_status'] = value_status(event)
        for metric in metrics:
            metric.setdefault('market_value_status', value_status(metric))

    calendar['all_event_enrichment_contract'] = 'ALL_CALENDAR_EVENTS_GENERIC_MARKET_MATCH_V1'
    calendar['all_event_enrichment'] = {
        'eligible_events': eligible,
        'matched_events': matched_events,
        'matched_metric_rows': matched_metrics,
        'field_updates': updates,
        'vendor_rows': len(rows),
        'checked_kst': now,
        'missing_policy': 'NEVER_INVENT_VALUES; NOT_PUBLISHED means source has not supplied a usable value',
    }
    CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_ALL_EVENTS_ENRICH=PASS eligible=', eligible, 'matched_events=', matched_events,
          'matched_metrics=', matched_metrics, 'vendor_rows=', len(rows), 'updates=', updates)


if __name__ == '__main__':
    main()
