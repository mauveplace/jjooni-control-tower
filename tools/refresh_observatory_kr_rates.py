#!/usr/bin/env python3
"""Refresh the Korean Treasury yield curve in Observatory from BOK ECOS.

The main Observatory builder historically queried the whole recent window with a
single 1..1000 ECOS page and silently kept old data on an exception.  This small
self-heal uses the same canonical BOK series identities, fetches the *tail* page
when a response exceeds 1000 rows, validates the requested item code and merges
only verified observations.  It never fabricates or interpolates yields.
"""
from __future__ import annotations

import json
import math
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OBS = ROOT / 'market-observatory' / 'data' / 'observatory.json'
KST = ZoneInfo('Asia/Seoul')
UA = 'Mozilla/5.0 JJOONI-KR-Rates-Freshness/1.0'
STAT_CODE = '817Y002'
KR_RATES = {
    'KR3Y': '010200000',
    'KR5Y': '010200001',
    'KR10Y': '010210000',
    'KR20Y': '010220000',
    'KR30Y': '010230000',
}
MAX_PAGE = 1000
LOOKBACK_DAYS = 500


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode('utf-8'))


def _url(key: str, start_count: int, end_count: int, start: str, end: str, item: str) -> str:
    safe_key = urllib.parse.quote(key, safe='')
    return (
        'https://ecos.bok.or.kr/api/StatisticSearch/' + safe_key +
        f'/json/kr/{start_count}/{end_count}/{STAT_CODE}/D/{start}/{end}/{item}'
    )


def _extract_rows(obj: dict, item: str) -> tuple[list[dict], int]:
    block = obj.get('StatisticSearch') or {}
    raw = block.get('row') or []
    total = int(block.get('list_total_count') or len(raw) or 0)
    out = []
    for r in raw:
        if r.get('STAT_CODE') and str(r.get('STAT_CODE')) != STAT_CODE:
            continue
        if r.get('ITEM_CODE1') and str(r.get('ITEM_CODE1')) != item:
            continue
        t = str(r.get('TIME') or '').strip()
        if len(t) == 8 and t.isdigit():
            d = f'{t[:4]}-{t[4:6]}-{t[6:8]}'
        else:
            d = t[:10]
        try:
            v = float(r.get('DATA_VALUE'))
        except Exception:
            continue
        if len(d) != 10 or not math.isfinite(v) or v <= -20 or v >= 50:
            continue
        out.append({'date': d, 'value': round(v, 8)})
    return out, total


def fetch_ecos_series(key: str, item: str, start: str, end: str) -> list[dict]:
    first = _get_json(_url(key, 1, MAX_PAGE, start, end, item))
    rows, total = _extract_rows(first, item)
    # ECOS returns ascending rows.  If there are more than 1000 observations,
    # request the tail explicitly so a busy/multidimensional series can never
    # freeze at the 1000th historical row.
    if total > MAX_PAGE:
        begin = max(1, total - MAX_PAGE + 1)
        tail = _get_json(_url(key, begin, total, start, end, item))
        tail_rows, _ = _extract_rows(tail, item)
        rows.extend(tail_rows)
    ded = {x['date']: x for x in rows}
    result = [ded[d] for d in sorted(ded)]
    if not result:
        code = ((first.get('RESULT') or {}).get('CODE') or 'NO_VERIFIED_ROWS')
        raise RuntimeError(f'ECOS_{item}_{code}')
    return result


def merge_rows(old: list[dict] | None, fresh: list[dict] | None) -> list[dict]:
    ded = {
        str(x.get('date') or '')[:10]: dict(x)
        for x in (old or [])
        if x.get('date') and x.get('value') is not None
    }
    for x in fresh or []:
        if x.get('date') and x.get('value') is not None:
            ded[str(x['date'])[:10]] = dict(x)
    return [ded[d] for d in sorted(ded)]


def _age_days(d: str | None) -> int | None:
    try:
        return (datetime.now(KST).date() - date.fromisoformat(str(d)[:10])).days
    except Exception:
        return None


def refresh(data: dict, api_key: str | None = None) -> dict:
    api_key = (api_key or os.getenv('BOK_ECOS_API_KEY') or 'sample').strip()
    end_d = datetime.now(KST).date()
    start_d = end_d - timedelta(days=LOOKBACK_DAYS)
    start = start_d.strftime('%Y%m%d')
    end = end_d.strftime('%Y%m%d')
    series = data.setdefault('series', {})
    latest = data.setdefault('latest', {})
    quality = data.setdefault('cross_market_freshness_quality', {})
    source = 'BOK ECOS 817Y002 daily market rates'
    failures = {}
    last_dates = {}

    for name, item in KR_RATES.items():
        try:
            fresh = fetch_ecos_series(api_key, item, start, end)
            merged = merge_rows(series.get(name), fresh)
            series[name] = merged
            latest[name] = merged[-1]['value'] if merged else None
            last = merged[-1]['date'] if merged else None
            last_dates[name] = last
            age = _age_days(last)
            status = 'LIVE' if age is not None and age <= 4 else ('LAGGING' if last else 'UNAVAILABLE')
            quality[name] = {
                'status': status,
                'source': source,
                'stat_code': STAT_CODE,
                'item_code': item,
                'last_date': last,
                'age_days': age,
                'verified_rows': len(fresh),
            }
            print(f'KR_RATE_REFRESH={name} status={status} last_date={last} rows={len(fresh)}')
        except Exception as exc:
            old = series.get(name) or []
            last = str((old[-1] if old else {}).get('date') or '')[:10] or None
            last_dates[name] = last
            failures[name] = f'{type(exc).__name__}:{exc}'
            quality[name] = {
                'status': 'STALE' if last else 'UNAVAILABLE',
                'source': source,
                'stat_code': STAT_CODE,
                'item_code': item,
                'last_date': last,
                'fetch_error': failures[name],
            }
            print(f'KR_RATE_REFRESH={name} status={quality[name]["status"]} last_date={last} error={failures[name]}')

    # Derived spread is produced only from two observations sharing the exact
    # same date; there is no tenor interpolation or carry-forward synthesis.
    kr3 = {x['date']: x['value'] for x in series.get('KR3Y', []) if x.get('date') and x.get('value') is not None}
    kr10 = {x['date']: x['value'] for x in series.get('KR10Y', []) if x.get('date') and x.get('value') is not None}
    common = sorted(set(kr3) & set(kr10))
    series['KR_3S10S'] = [{'date': d, 'value': round(kr10[d] - kr3[d], 8)} for d in common]
    latest['KR_3S10S'] = series['KR_3S10S'][-1]['value'] if common else None
    spread_last = common[-1] if common else None
    last_dates['KR_3S10S'] = spread_last

    ages = [_age_days(last_dates.get(k)) for k in KR_RATES]
    group_live = not failures and all(a is not None and a <= 4 for a in ages)
    quality['KR_RATES'] = {
        'status': 'LIVE' if group_live else 'LAGGING',
        'source': source,
        'last_dates': last_dates,
        'failed_series': failures,
        'spread_contract': 'SAME_DATE_KR10Y_MINUS_KR3Y_NO_INTERPOLATION',
    }
    data.setdefault('sources', {})['KR_RATES_CURRENT'] = source
    data['kr_rates_refreshed_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    return data


def main() -> None:
    data = json.loads(OBS.read_text(encoding='utf-8'))
    refresh(data)
    OBS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    q = (data.get('cross_market_freshness_quality') or {}).get('KR_RATES') or {}
    print('KR_RATES_REFRESH=' + str(q.get('status')) + ' last_dates=' + json.dumps(q.get('last_dates') or {}, ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
