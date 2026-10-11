#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
OVR = ROOT / 'market-observatory' / 'data' / 'calendar-manual-overrides.json'
OUT = ROOT / 'market-observatory' / 'data' / 'economic-calendar-history.json'
KST = ZoneInfo('Asia/Seoul')
WINDOW_DAYS = 365

MONTHS = 'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec'.split()
STOP = {'release','report','survey','preliminary','final','advance','revised','revision','estimate','estimates','data'}


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ('', '-', '—', 'None', 'null', 'N/A') else s


def event_date(e):
    return str(e.get('datetime_kst') or e.get('date') or '')[:10]


def canonical_title(title):
    s = str(title or '').lower()
    s = re.sub(r'\([^)]*\)', ' ', s)
    s = re.sub(r'\b20\d{2}\b', ' ', s)
    s = re.sub(r'\b(?:' + '|'.join(MONTHS) + r')\b', ' ', s, flags=re.I)
    s = re.sub(r'\b\d{1,2}(?:st|nd|rd|th)?\b', ' ', s)
    s = re.sub(r'\d{4}년\s*\d{1,2}월', ' ', s)
    s = re.sub(r'\d{1,2}월', ' ', s)
    s = re.sub(r'[^a-z0-9가-힣]+', ' ', s)
    parts = [p for p in s.split() if p not in STOP]
    return ' '.join(parts).strip()


def slug(text):
    s = canonical_title(text)
    s = re.sub(r'\s+', '-', s).strip('-')
    return s[:140] or 'event'


def event_ref(e):
    explicit = clean(e.get('history_ref'))
    if explicit:
        return explicit
    return f"{str(e.get('country') or 'XX').upper()}::{slug(e.get('title'))}"


def metric_ref(e, m):
    explicit = clean(m.get('history_ref'))
    if explicit:
        return explicit
    key = clean(m.get('key')) or slug(m.get('label'))
    return f"{event_ref(e)}::{key}"


def row_payload(e, obj, label, metric_key=None):
    return {
        'date': event_date(e),
        'datetime_kst': e.get('datetime_kst') or e.get('date'),
        'reference_period': e.get('reference_period'),
        'previous': clean(obj.get('previous')),
        'consensus': clean(obj.get('consensus')),
        'actual': clean(obj.get('actual')),
        'te_forecast': clean(obj.get('te_forecast')),
        'surprise': clean(obj.get('surprise')),
        'source': obj.get('market_value_source') or obj.get('actual_source') or obj.get('source') or e.get('market_data_source') or e.get('source'),
        'source_tier': obj.get('source_tier') or e.get('source_tier'),
        'verification_status': obj.get('verification_status') or e.get('verification_status'),
        'metric_key': metric_key,
        'label': label,
    }


def has_values(row):
    return any(clean(row.get(k)) is not None for k in ('previous','consensus','actual','te_forecast'))


def add_series(series, ref, meta, row):
    bucket = series.setdefault(ref, {'ref': ref, **meta, 'rows': []})
    if not has_values(row):
        return
    key = (row.get('date'), row.get('metric_key'))
    existing = {(x.get('date'), x.get('metric_key')): i for i, x in enumerate(bucket['rows'])}
    if key in existing:
        old = bucket['rows'][existing[key]]
        merged = dict(old)
        for k, v in row.items():
            if v is not None:
                merged[k] = v
        bucket['rows'][existing[key]] = merged
    else:
        bucket['rows'].append(row)


def source_events(calendar, overrides):
    seen = set()
    for e in calendar.get('events') or []:
        key = (event_date(e), e.get('country'), e.get('title'))
        seen.add(key)
        yield e
    for o in overrides.get('overrides') or []:
        e = o.get('event')
        if not isinstance(e, dict):
            continue
        clone = dict(e)
        if o.get('market_metrics') and not clone.get('market_metrics'):
            clone['market_metrics'] = o['market_metrics']
        for k in ('previous','consensus','actual'):
            if clean(o.get(k)) is not None and clean(clone.get(k)) is None:
                clone[k] = o[k]
        key = (event_date(clone), clone.get('country'), clone.get('title'))
        if key in seen:
            continue
        seen.add(key)
        yield clone


def main():
    now = datetime.now(KST)
    today = now.date()
    start = today - timedelta(days=WINDOW_DAYS)
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    overrides = json.loads(OVR.read_text(encoding='utf-8')) if OVR.exists() else {'overrides': []}
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {'series': {}}
    series = {}

    # Preserve prior archived rows first. This makes the file a rolling SSOT
    # instead of rebuilding only from whatever the current schedule still carries.
    for ref, bucket in (old.get('series') or {}).items():
        meta = {k: v for k, v in bucket.items() if k not in ('rows', 'count', 'available_from', 'available_to')}
        for row in bucket.get('rows') or []:
            day = str(row.get('date') or '')[:10]
            if start.isoformat() <= day <= today.isoformat():
                add_series(series, ref, meta, dict(row))

    event_count = metric_count = 0
    for e in source_events(calendar, overrides):
        day = event_date(e)
        if not day or day > today.isoformat() or day < start.isoformat():
            continue
        eref = event_ref(e)
        e['history_ref'] = eref
        erow = row_payload(e, e, e.get('title') or 'Event')
        add_series(series, eref, {
            'country': e.get('country'), 'event_title': e.get('title'), 'label': e.get('title'),
            'kind': 'event', 'category': e.get('category'),
        }, erow)
        if has_values(erow):
            event_count += 1

        for m in e.get('market_metrics') or []:
            if not isinstance(m, dict) or m.get('metric_type') == 'market_probability_snapshot':
                continue
            mref = metric_ref(e, m)
            m['history_ref'] = mref
            mrow = row_payload(e, m, m.get('label') or m.get('key') or 'Metric', m.get('key'))
            add_series(series, mref, {
                'country': e.get('country'), 'event_title': e.get('title'),
                'label': m.get('label') or m.get('key'), 'metric_key': m.get('key'),
                'kind': 'metric', 'category': e.get('category'),
            }, mrow)
            if has_values(mrow):
                metric_count += 1

    # Add refs to every current event, including future events, so the UI can
    # resolve their prior one-year records immediately.
    for e in calendar.get('events') or []:
        e['history_ref'] = event_ref(e)
        for m in e.get('market_metrics') or []:
            if isinstance(m, dict) and m.get('metric_type') != 'market_probability_snapshot':
                m['history_ref'] = metric_ref(e, m)

    total_rows = 0
    earliest = None
    latest = None
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

    coverage = 'FULL' if earliest and earliest <= (start + timedelta(days=14)).isoformat() else 'PARTIAL'
    out = {
        'schema': 'JJOONI_ECONOMIC_CALENDAR_HISTORY_V1',
        'generated_kst': now.isoformat(timespec='seconds'),
        'timezone': 'Asia/Seoul',
        'window_days': WINDOW_DAYS,
        'window_start': start.isoformat(),
        'window_end': today.isoformat(),
        'coverage_status': coverage,
        'available_from': earliest,
        'available_to': latest,
        'series_count': len(series),
        'row_count': total_rows,
        'series': series,
        'contract': 'ROLLING_365D_EVENT_AND_METRIC_HISTORY_PRESERVE_V1',
        'missing_policy': 'Historical consensus/actual is shown only when captured or verified; values are never synthesized.',
    }
    CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_HISTORY_1Y=PASS series=', len(series), 'rows=', total_rows,
          'coverage=', coverage, 'available_from=', earliest, 'event_rows=', event_count, 'metric_rows=', metric_count)


if __name__ == '__main__':
    main()
