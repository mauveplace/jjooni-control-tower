#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from calendar_actual_contract import PROVENANCE, merge_observation

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
KST = ZoneInfo('Asia/Seoul')

COUNTRY_NAME = {
    'US': 'united states',
    'KR': 'south korea',
    'JP': 'japan',
    'GB': 'united kingdom',
}
CURRENCY = {'US': 'USD', 'KR': 'KRW', 'JP': 'JPY', 'GB': 'GBP'}

STOP = {
    'the','and','of','for','in','on','at','to','a','an','report','release','survey','index','indexes',
    'united','states','us','u','s','korea','south','japan','uk','kingdom','preliminary','final',
    'advance','revised','revision','estimate','estimates','monthly','quarterly','annual','data'
}

REPLACEMENTS = [
    (r'consumer price index', ' cpi '),
    (r'producer price index', ' ppi '),
    (r'personal consumption expenditures', ' pce '),
    (r'gross domestic product', ' gdp '),
    # BEA's formal schedule title and market calendars describe the same release
    # differently.  Keep this explicit rather than weakening fuzzy thresholds.
    (r'(?:u\.?s\.?\s+)?international trade in goods and services', ' trade balance '),
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


def norm(value):
    return re.sub(r'[^a-z0-9가-힣]+',' ',str(value or '').lower()).strip()


def clean(value):
    if value is None:
        return None
    s = str(value).strip()
    return None if s in ('','None','null','nan','N/A','-','—') else s


def date_delta(a, b):
    try:
        return abs((datetime.fromisoformat(str(a)[:10]).date() - datetime.fromisoformat(str(b)[:10]).date()).days)
    except Exception:
        return 999


def row_kst_date(row):
    try:
        return datetime.fromisoformat(str(row.get('date'))).astimezone(KST).date().isoformat()
    except Exception:
        return ''


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


def normalized_rows(te=None, ff=None):
    """Normalize rows already fetched by the canonical enricher.

    The all-event pass must not make a second network request in the same
    refresh. Reusing the first fetch makes enrichment deterministic when public
    feeds are transiently unavailable on a subsequent call.
    """
    rows = []
    for r in te or []:
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
    for r in ff or []:
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


def metric_identity_compatible(metric, row):
    """Reject fuzzy matches that change the indicator, direction, or frequency.

    Event titles often contain *both* import and export; fuzzy similarity alone
    can otherwise copy the import observation into the export metric.  Likewise
    PPI MoM must never be accepted as PPI YoY or as core PPI.
    """
    key = set(canonical(metric.get('key') or '').split())
    observed = tokens(row.get('title'))
    for qualifier in ('import', 'export', 'mom', 'yoy', 'qoq'):
        if qualifier in key and qualifier not in observed:
            return False
    for a, opposite in (('import', 'export'), ('export', 'import'),
                        ('mom', 'yoy'), ('yoy', 'mom'),
                        ('mom', 'qoq'), ('qoq', 'mom'),
                        ('yoy', 'qoq'), ('qoq', 'yoy')):
        if a in key and opposite in observed:
            return False
    if 'core' in key and 'core' not in observed:
        return False
    if 'core' not in key and 'core' in observed and ('ppi' in key or 'cpi' in key):
        return False
    return True


def patch_observation(target, row, now):
    before = {k: clean(target.get(k)) for k in ('previous','consensus','actual')}
    patch = {
        'previous': row.get('previous'), 'consensus': row.get('consensus'), 'actual': row.get('actual'),
        'source_tier': row.get('source_tier'), 'actual_source': row.get('provider'),
        'source_url': row.get('source_url'), 'checked_kst': now,
        'verification_status': 'MARKET_REPORTED',
    }
    target.update(merge_observation(target, patch))
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
    source = clean(primary.get('market_value_source')) or clean(primary.get('actual_source')) or clean(primary.get('source'))
    if source and not clean(event.get('market_data_source')):
        event['market_data_source'] = source


def value_status(obj):
    if clean(obj.get('actual')) is not None:
        return 'ACTUAL_AVAILABLE'
    if clean(obj.get('consensus')) is not None:
        return 'CONSENSUS_AVAILABLE'
    if clean(obj.get('previous')) is not None:
        return 'PREVIOUS_ONLY'
    return 'NOT_PUBLISHED'


def apply_all_event_enrichment(calendar, te, ff, now=None):
    rows = normalized_rows(te, ff)
    checked = now.isoformat(timespec='seconds') if isinstance(now, datetime) else str(now or datetime.now(KST).isoformat(timespec='seconds'))
    eligible = matched_events = matched_metrics = updates = 0

    for event in calendar.get('events') or []:
        if event.get('country') not in COUNTRY_NAME:
            continue
        eligible += 1
        metrics = [m for m in (event.get('market_metrics') or []) if isinstance(m, dict)]
        metric_hits = 0
        for metric in metrics:
            if metric.get('metric_type') == 'market_probability_snapshot':
                continue
            label = metric.get('label') or metric.get('key') or event.get('title')
            query = f"{label} {event.get('title') or ''}"
            eligible_rows = [r for r in rows if metric_identity_compatible(metric, r)]
            row, score = best_row(query, event, eligible_rows, threshold=57.0)
            if not row:
                row, score = best_row(label, event, eligible_rows, threshold=57.0)
            if row:
                updates += patch_observation(metric, row, checked)
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
                updates += patch_observation(event, row, checked)
                event['generic_match_score'] = score
                if row.get('te_forecast') and clean(event.get('te_forecast')) is None:
                    event['te_forecast'] = row['te_forecast']
                if row.get('provider') and not clean(event.get('market_data_source')):
                    event['market_data_source'] = row['provider']
                matched_events += 1

        event['market_value_status'] = value_status(event)
        for metric in metrics:
            metric.setdefault('market_value_status', value_status(metric))

    stats = {
        'eligible_events': eligible,
        'matched_events': matched_events,
        'matched_metric_rows': matched_metrics,
        'field_updates': updates,
        'vendor_rows': len(rows),
        'checked_kst': checked,
        'missing_policy': 'NEVER_INVENT_VALUES; NOT_PUBLISHED means source has not supplied a usable value',
        'row_reuse_contract': 'REUSE_PRIMARY_ENRICHER_FETCH_V1',
    }
    calendar['all_event_enrichment_contract'] = 'ALL_CALENDAR_EVENTS_GENERIC_MARKET_MATCH_V1'
    calendar['all_event_enrichment'] = stats
    return stats


def main():
    # Standalone/debug entrypoint. Production calls apply_all_event_enrichment
    # from enrich_economic_calendar.py with the rows it already fetched.
    from enrich_economic_calendar import ff_rows, te_rows
    calendar = json.loads(CAL.read_text(encoding='utf-8'))
    te = te_rows()
    ff = ff_rows()
    stats = apply_all_event_enrichment(calendar, te, ff, datetime.now(KST))
    CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CALENDAR_ALL_EVENTS_ENRICH=PASS', stats)


if __name__ == '__main__':
    main()
