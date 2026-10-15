#!/usr/bin/env python3
"""Store observed Cboe yield-index bars; never infer yields from futures prices."""
import json
import math
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'market-observatory/data/us-rates-intraday.json'
KST = ZoneInfo('Asia/Seoul')
SERIES = {
    'US13W': ('^IRX', '13주 단기물'),
    'US5Y': ('^FVX', '5년물'),
    'US10Y': ('^TNX', '10년물'),
    'US30Y': ('^TYX', '30년물'),
}


def source_url(symbol):
    return 'https://query1.finance.yahoo.com/v8/finance/chart/' + urllib.parse.quote(symbol, safe='') + '?range=5d&interval=5m'


def fetch(symbol):
    request = urllib.request.Request(source_url(symbol), headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=18) as response:
        return json.load(response)


def parse_payload(payload, symbol, now):
    chart = payload.get('chart') or {}
    result = chart.get('result') or []
    if chart.get('error') or len(result) != 1:
        raise ValueError('SOURCE_CHART_UNAVAILABLE')
    doc = result[0]
    if (doc.get('meta') or {}).get('symbol') != symbol:
        raise ValueError('SOURCE_SYMBOL_MISMATCH')
    stamps = doc.get('timestamp') or []
    quotes = ((doc.get('indicators') or {}).get('quote') or [{}])[0]
    values = quotes.get('close') or []
    if len(stamps) != len(values):
        raise ValueError('SOURCE_BAR_ALIGNMENT')
    points = {}
    for stamp, value in zip(stamps, values):
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 30:
            raise ValueError('YIELD_PERCENT_UNIT_OR_VALUE')
        if isinstance(stamp, bool) or not isinstance(stamp, int) or stamp > now.timestamp() + 60:
            raise ValueError('SOURCE_TIMESTAMP_INVALID')
        points[stamp] = {'timestamp': stamp, 'yield_pct': round(value, 6)}
    if not points:
        raise ValueError('SOURCE_BARS_EMPTY')
    return [points[k] for k in sorted(points)]


def build(previous=None, now=None, fetcher=fetch):
    now = now or datetime.now(KST)
    previous = previous or {}
    cutoff = (now - timedelta(days=30)).timestamp()
    sources = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {key: pool.submit(fetcher, symbol) for key, (symbol, _) in SERIES.items()}
        for key, (symbol, label) in SERIES.items():
            old = (previous.get('series') or {}).get(key) or {}
            points = {p['timestamp']: p for p in old.get('points', []) if p['timestamp'] >= cutoff}
            state, error = 'AVAILABLE', None
            try:
                observed = parse_payload(jobs[key].result(), symbol, now)
                points.update({p['timestamp']: p for p in observed if p['timestamp'] >= cutoff})
                last_success = now.isoformat(timespec='seconds')
            except Exception as exc:
                state = 'STALE' if points else 'UNAVAILABLE'
                error = type(exc).__name__ + ': ' + str(exc)[:140]
                last_success = old.get('last_success_kst')
            ordered = [points[k] for k in sorted(points)]
            sources[key] = {
                'symbol': symbol, 'label': label, 'unit': 'percent_yield',
                'state': state, 'error': error, 'last_success_kst': last_success,
                'last_observed_kst': datetime.fromtimestamp(ordered[-1]['timestamp'], KST).isoformat(timespec='seconds') if ordered else None,
                'source_url': source_url(symbol), 'points': ordered,
            }
    return {
        'schema': 'JJOONI_US_RATES_INTRADAY_V1', 'generated_kst': now.isoformat(timespec='seconds'),
        'timezone': 'Asia/Seoul', 'bar_interval_minutes': 5, 'retention_days': 30,
        'source': 'Yahoo Finance / Cboe Treasury yield indices',
        'data_contract': 'OBSERVED_YIELD_INDEX_BARS_NOT_OFFICIAL_DAILY_CURVE',
        'contains_account_data': False, 'read_only': True,
        'unavailable_tenors': {'US2Y': 'No 2-year yield index in this source; view the separate 2-year market-yield chart.'},
        'series': sources,
    }


def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {}
    document = build(previous)
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n')
    states = {k: v['state'] for k, v in document['series'].items()}
    print('US_RATES_INTRADAY=' + json.dumps(states))
    if any(state != 'AVAILABLE' for state in states.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
