#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
OVR = ROOT / 'market-observatory' / 'data' / 'calendar-manual-overrides.json'
KST = ZoneInfo('Asia/Seoul')
UA = 'Mozilla/5.0 JJOONI-Market-Observatory-KeyEvents/1.0'

FOMC_2026_KST = [
    '2026-01-29T04:00+09:00',
    '2026-03-19T03:00+09:00',
    '2026-04-30T03:00+09:00',
    '2026-06-18T03:00+09:00',
    '2026-07-30T03:00+09:00',
    '2026-09-17T03:00+09:00',
    '2026-10-29T03:00+09:00',
    '2026-12-10T04:00+09:00',
]


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ('', '-', '—', 'None', 'null', 'N/A') else s


def event_date(e):
    return str(e.get('datetime_kst') or e.get('date') or '')[:10]


def ensure_fields(e):
    for k in ['previous', 'consensus', 'actual', 'te_forecast', 'surprise', 'market_data_source']:
        e.setdefault(k, None)
    e.setdefault('market_metrics', [])
    return e


def upsert(events, payload):
    dt = payload['datetime_kst']
    title = payload['title']
    country = payload['country']
    for e in events:
        if e.get('datetime_kst') == dt and e.get('title') == title and e.get('country') == country:
            e.update(payload)
            return e
    events.append(payload)
    return payload


def seed():
    c = json.loads(CAL.read_text(encoding='utf-8'))
    events = c.setdefault('events', [])

    # The base builder historically stored the U.S. local meeting date with an
    # arbitrary KST clock time. Replace it with the actual 2:00pm ET statement
    # release converted to Korea time. This avoids duplicate/wrong FOMC cards.
    events[:] = [e for e in events if not (e.get('country') == 'US' and e.get('title') == 'FOMC 정책결정')]
    for dt in FOMC_2026_KST:
        upsert(events, {
            'datetime_kst': dt,
            'title': 'FOMC 정책결정',
            'country': 'US',
            'category': '중앙은행',
            'importance': 3,
            'source': 'Federal Reserve',
            'reference_period': '',
        })

    fixed = [
        {
            'datetime_kst': '2026-09-11T23:00+09:00',
            'title': 'University of Michigan Consumer Sentiment (Preliminary)',
            'country': 'US', 'category': '심리/기대인플레', 'importance': 3,
            'source': 'University of Michigan', 'reference_period': '2026-09 preliminary',
        },
        {
            'datetime_kst': '2026-09-25T23:00+09:00',
            'title': 'University of Michigan Consumer Sentiment (Final)',
            'country': 'US', 'category': '심리/기대인플레', 'importance': 2,
            'source': 'University of Michigan', 'reference_period': '2026-09 final',
        },
        {
            'datetime_kst': '2026-09-17T20:00+09:00',
            'title': 'Bank of England 금리 결정',
            'country': 'GB', 'category': '중앙은행', 'importance': 3,
            'source': 'Bank of England', 'reference_period': 'September 2026 MPC',
        },
        {
            'datetime_kst': '2026-09-17T21:30+09:00',
            'title': 'U.S. Initial Jobless Claims',
            'country': 'US', 'category': '고용', 'importance': 2,
            'source': 'U.S. Department of Labor', 'reference_period': 'weekly',
        },
        {
            # BOJ policy decisions are released after the meeting ends; the
            # exact intraday release time is not pre-announced. Noon is only a
            # sorting placeholder and the UI-visible title says time TBD.
            'datetime_kst': '2026-09-18T12:00+09:00',
            'title': 'BOJ 금융정책결정회의 결과 (발표시간 미정)',
            'country': 'JP', 'category': '중앙은행', 'importance': 3,
            'source': 'Bank of Japan', 'reference_period': 'Sep 17-18, 2026 meeting',
            'time_status': 'TBD',
        },
        {
            # Micron officially scheduled its FY2026 Q4 call for Sep 30,
            # 2:30pm Mountain Time, which is Oct 1 05:30 KST.
            'datetime_kst': '2026-10-01T05:30+09:00',
            'title': 'Micron FY2026 Q4 실적 컨퍼런스콜 (미 현지 9/30)',
            'country': 'US', 'category': '기업실적', 'importance': 2,
            'source': 'Micron Investor Relations', 'reference_period': 'FY2026 Q4',
        },
    ]
    for e in fixed:
        upsert(events, e)

    # Remove the incorrect 9/23 Micron date if it was ever seeded manually.
    events[:] = [e for e in events if not (
        event_date(e) == '2026-09-23' and 'Micron' in str(e.get('title') or '')
    )]

    for e in events:
        ensure_fields(e)
    events.sort(key=lambda x: str(x.get('datetime_kst') or ''))
    c['key_event_contract'] = 'VERIFIED_KST_POLICY_AND_SENTIMENT_CALENDAR_V1'
    c['key_event_seeded_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    CAL.write_text(json.dumps(c, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('KEY_MARKET_EVENTS_SEED=PASS events=', len(events))


def ff_rows():
    out = []
    for name in ['thisweek', 'nextweek']:
        try:
            req = urllib.request.Request(
                f'https://nfs.faireconomy.media/ff_calendar_{name}.json',
                headers={'User-Agent': UA, 'Accept': 'application/json'},
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                xs = json.load(r)
            if isinstance(xs, list):
                out.extend(xs)
        except Exception:
            pass
    return out


def row_kst_date(row):
    try:
        return datetime.fromisoformat(str(row.get('date'))).astimezone(KST).date().isoformat()
    except Exception:
        return ''


def ff_match(rows, day, country, contains):
    for r in rows:
        if str(r.get('country') or '').upper() != country:
            continue
        if row_kst_date(r) != day:
            continue
        title = str(r.get('title') or '').lower()
        if all(x.lower() in title for x in contains):
            return r
    return None


def merge_metric(event, metric):
    rows = event.setdefault('market_metrics', [])
    key = metric.get('key') or metric.get('label')
    for i, old in enumerate(rows):
        if (old.get('key') or old.get('label')) == key:
            merged = dict(old)
            for k, v in metric.items():
                if clean(v) is not None:
                    merged[k] = v
            rows[i] = merged
            return
    rows.append(metric)


def add_ff_metric(event, row, key, label, source='FairEconomy/ForexFactory'):
    if not row:
        return False
    metric = {
        'key': key,
        'label': label,
        'previous': clean(row.get('previous')),
        'consensus': clean(row.get('forecast')),
        'actual': clean(row.get('actual')),
        'source': source,
        'event_title': clean(row.get('title')),
        'datetime_source': clean(row.get('date')),
        'impact': clean(row.get('impact')),
    }
    merge_metric(event, metric)
    return True


def apply_overrides(c):
    if not OVR.exists():
        return 0
    o = json.loads(OVR.read_text(encoding='utf-8'))
    applied = 0
    for override in o.get('overrides') or []:
        m = override.get('match') or {}
        target = None
        for e in c.get('events') or []:
            if m.get('date') and event_date(e) != m.get('date'):
                continue
            if m.get('country') and e.get('country') != m.get('country'):
                continue
            if m.get('title_contains') and m.get('title_contains') not in str(e.get('title') or ''):
                continue
            target = e
            break
        if target is None and override.get('event'):
            target = ensure_fields(dict(override['event']))
            c.setdefault('events', []).append(target)
        if target is None:
            continue
        ensure_fields(target)
        for metric in override.get('market_metrics') or []:
            merge_metric(target, metric)
        for k in ['previous', 'consensus', 'actual']:
            if clean(override.get(k)) is not None:
                target[k] = override[k]
        src = clean(override.get('source'))
        if src:
            existing = clean(target.get('market_data_source'))
            if existing and src not in existing:
                target['market_data_source'] = existing + ' + ' + src
            elif not existing:
                target['market_data_source'] = src
        # Compact clients get the first populated metric as representative.
        primary = next((x for x in target.get('market_metrics') or [] if any(clean(x.get(k)) is not None for k in ['previous','consensus','actual'])), None)
        if primary:
            for k in ['previous', 'consensus', 'actual']:
                if clean(primary.get(k)) is not None:
                    target[k] = primary[k]
        target['_verified_override'] = True
        applied += 1
    return applied


def refresh():
    c = json.loads(CAL.read_text(encoding='utf-8'))
    rows = ff_rows()
    dynamic = 0
    for e in c.get('events') or []:
        ensure_fields(e)
        day = event_date(e)
        title = str(e.get('title') or '')
        if title.startswith('University of Michigan Consumer Sentiment'):
            dynamic += int(add_ff_metric(e, ff_match(rows, day, 'USD', ['uom', 'consumer sentiment']), 'umich_sentiment', 'UoM Consumer Sentiment'))
            dynamic += int(add_ff_metric(e, ff_match(rows, day, 'USD', ['uom', 'inflation expectations']), 'umich_inflation_1y', 'UoM 1Y Inflation Expectations'))
        elif title == 'U.S. Initial Jobless Claims':
            dynamic += int(add_ff_metric(e, ff_match(rows, day, 'USD', ['unemployment claims']), 'initial_claims', 'Initial Jobless Claims'))

    applied = apply_overrides(c)
    c.setdefault('events', []).sort(key=lambda x: str(x.get('datetime_kst') or ''))
    c['verified_override_contract'] = 'SERVER_SIDE_VERIFIED_OVERRIDE_MERGE_V1'
    c['market_event_refresh'] = {
        'faireconomy_rows': len(rows),
        'dynamic_metric_matches': dynamic,
        'verified_overrides_applied': applied,
        'refreshed_kst': datetime.now(KST).isoformat(timespec='seconds'),
    }
    CAL.write_text(json.dumps(c, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('KEY_MARKET_EVENTS_REFRESH=PASS ff_rows=', len(rows), 'dynamic=', dynamic, 'overrides=', applied)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'refresh'
    if mode == 'seed':
        seed()
    elif mode == 'refresh':
        refresh()
    else:
        raise SystemExit('usage: calendar_market_events.py [seed|refresh]')


if __name__ == '__main__':
    main()
