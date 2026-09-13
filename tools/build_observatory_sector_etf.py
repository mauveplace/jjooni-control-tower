#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'market-observatory' / 'data' / 'sector-etf.json'
KST = ZoneInfo('Asia/Seoul')
ET = ZoneInfo('America/New_York')
UA = 'Mozilla/5.0 JJOONI-Market-Observatory-Sector/1.1'
YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'

BENCHMARKS = {
    'SPY': 'SPDR S&P 500 ETF Trust',
    'QQQ': 'Invesco QQQ Trust',
}

GROUPS = [
    ('classic', 'S&P 500 섹터', [
        ('XLK', 'Technology'),
        ('XLC', 'Communication Services'),
        ('XLY', 'Consumer Discretionary'),
        ('XLF', 'Financials'),
        ('XLI', 'Industrials'),
        ('XLE', 'Energy'),
        ('XLB', 'Materials'),
        ('XLV', 'Health Care'),
        ('XLP', 'Consumer Staples'),
        ('XLU', 'Utilities'),
        ('XLRE', 'Real Estate'),
    ]),
    ('semiconductor', '반도체·메모리', [
        ('SMH', 'VanEck Semiconductor ETF'),
        ('SOXX', 'iShares Semiconductor ETF'),
    ]),
    ('software', '소프트웨어·클라우드·사이버', [
        ('IGV', 'iShares Expanded Tech-Software Sector ETF'),
        ('SKYY', 'First Trust Cloud Computing ETF'),
        ('HACK', 'ETFMG Prime Cyber Security ETF'),
    ]),
    ('biotech', '바이오', [
        ('XBI', 'SPDR S&P Biotech ETF'),
    ]),
    ('financial', '지역은행', [
        ('KRE', 'SPDR S&P Regional Banking ETF'),
    ]),
    ('defense_infra', '방산·인프라·에너지', [
        ('ITA', 'iShares U.S. Aerospace & Defense ETF'),
        ('XAR', 'SPDR S&P Aerospace & Defense ETF'),
        ('PAVE', 'Global X U.S. Infrastructure Development ETF'),
        ('XOP', 'SPDR S&P Oil & Gas Exploration & Production ETF'),
    ]),
    ('robotics', '로봇·자동화', [
        ('BOTZ', 'Global X Robotics & Artificial Intelligence ETF'),
        ('ROBO', 'ROBO Global Robotics and Automation Index ETF'),
    ]),
]

HORIZONS = (1, 5, 10, 20, 50, 100)


def request_json(url: str, timeout: int = 20):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def yahoo_series(symbol: str, range_: str = '1y'):
    qs = urllib.parse.urlencode({
        'interval': '1d',
        'range': range_,
        'includePrePost': 'false',
        'events': 'div,splits',
    })
    url = YAHOO + urllib.parse.quote(symbol, safe='') + '?' + qs
    last_error = None
    for attempt in range(3):
        try:
            obj = request_json(url)
            rs = ((obj.get('chart') or {}).get('result') or [])
            if not rs:
                raise RuntimeError('empty Yahoo result')
            block = rs[0]
            ts = block.get('timestamp') or []
            closes = ((((block.get('indicators') or {}).get('quote') or [{}])[0]).get('close') or [])
            out = []
            for t, v in zip(ts, closes):
                if v is None:
                    continue
                try:
                    v = float(v)
                except Exception:
                    continue
                if not math.isfinite(v):
                    continue
                d = datetime.fromtimestamp(int(t), ET).date().isoformat()
                out.append({'date': d, 'value': round(v, 8)})
            dedup = {x['date']: x for x in out}
            rows = [dedup[k] for k in sorted(dedup)]
            if len(rows) < 101:
                raise RuntimeError(f'insufficient points for 100d horizon: {len(rows)}')
            return rows
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.7 * (attempt + 1))
    raise RuntimeError(f'Yahoo fetch failed for {symbol}: {last_error}')


def load_previous():
    try:
        return json.loads(OUT.read_text(encoding='utf-8'))
    except Exception:
        return {}


def pct_from_points(points, sessions):
    if not points or len(points) <= sessions:
        return None
    a = points[-1]['value']
    b = points[-1 - sessions]['value']
    if not b:
        return None
    return (a / b - 1.0) * 100.0


def ytd_return(points):
    if not points:
        return None
    current_date = points[-1]['date']
    year = current_date[:4]
    base = next((x['value'] for x in points if x['date'].startswith(year)), None)
    if base in (None, 0):
        return None
    return (points[-1]['value'] / base - 1.0) * 100.0


def avg(values):
    xs = [x for x in values if x is not None]
    return sum(xs) / len(xs) if xs else None


def rounded(v, digits=4):
    return None if v is None or not math.isfinite(v) else round(v, digits)


def metrics(points):
    if not points:
        return {}
    values = [x['value'] for x in points]
    price = values[-1]
    ma20 = avg(values[-20:]) if len(values) >= 20 else None
    ma60 = avg(values[-60:]) if len(values) >= 60 else None
    high20 = max(values[-20:]) if len(values) >= 20 else None
    out = {
        'price': rounded(price, 4),
        'ytd_pct': rounded(ytd_return(points)),
        'ma20': rounded(ma20, 4),
        'ma60': rounded(ma60, 4),
        'vs_ma20_pct': rounded((price / ma20 - 1.0) * 100.0) if ma20 else None,
        'vs_ma60_pct': rounded((price / ma60 - 1.0) * 100.0) if ma60 else None,
        'high20_gap_pct': rounded((price / high20 - 1.0) * 100.0) if high20 else None,
        'above_ma20': bool(ma20 is not None and price >= ma20),
        'above_ma60': bool(ma60 is not None and price >= ma60),
        'observed_date': points[-1]['date'],
    }
    for d in HORIZONS:
        out[f'ret_{d}d_pct'] = rounded(pct_from_points(points, d))
    # Legacy fields retained for existing consumers/QA.
    out['ret_1m_pct'] = rounded(pct_from_points(points, 21))
    out['ret_3m_pct'] = rounded(pct_from_points(points, 63))
    return out


def relative(row, bench, key):
    a = row.get(key)
    b = bench.get(key)
    return rounded(a - b) if a is not None and b is not None else None


def build():
    previous = load_previous()
    prev_series = previous.get('series') or {}
    series = {}
    fetch_errors = {}

    tickers = list(BENCHMARKS.keys())
    for _, _, rows in GROUPS:
        tickers.extend(t for t, _ in rows)

    for ticker in dict.fromkeys(tickers):
        try:
            series[ticker] = yahoo_series(ticker, '1y')
            time.sleep(0.12)
        except Exception as exc:
            fallback = prev_series.get(ticker) or []
            if fallback:
                series[ticker] = fallback
            else:
                series[ticker] = []
            fetch_errors[ticker] = str(exc)

    bm_metrics = {ticker: metrics(series.get(ticker) or []) for ticker in BENCHMARKS}
    spy = bm_metrics.get('SPY') or {}
    qqq = bm_metrics.get('QQQ') or {}

    group_payload = []
    all_rows = []
    for key, label, members in GROUPS:
        rows = []
        for ticker, name in members:
            m = metrics(series.get(ticker) or [])
            if m:
                m.update({
                    'ticker': ticker,
                    'name': name,
                    'group': label,
                    'group_key': key,
                    'source': 'Yahoo public daily',
                })
                for d in HORIZONS:
                    key_name = f'ret_{d}d_pct'
                    m[f'rs_spy_{d}d_pct'] = relative(m, spy, key_name)
                    m[f'rs_qqq_{d}d_pct'] = relative(m, qqq, key_name)
                # Legacy fields retained for existing consumers/QA.
                m['rs_spy_1m_pct'] = relative(m, spy, 'ret_1m_pct')
                m['rs_qqq_1m_pct'] = relative(m, qqq, 'ret_1m_pct')
            else:
                m = {'ticker': ticker, 'name': name, 'group': label, 'group_key': key, 'source': 'UNAVAILABLE'}
            rows.append(m)
            all_rows.append(m)
        group_payload.append({'key': key, 'label': label, 'rows': rows})

    classic = next((g['rows'] for g in group_payload if g['key'] == 'classic'), [])
    ranked_20d = sorted([r for r in classic if r.get('rs_spy_20d_pct') is not None], key=lambda r: r['rs_spy_20d_pct'], reverse=True)
    ranked_1m = sorted([r for r in classic if r.get('rs_spy_1m_pct') is not None], key=lambda r: r['rs_spy_1m_pct'], reverse=True)
    priced = [r for r in all_rows if r.get('price') is not None]
    above_ma20 = [r for r in classic if r.get('above_ma20') is True]

    growth_20d = [r.get('ret_20d_pct') for r in classic if r.get('ticker') in {'XLK', 'XLC', 'XLY'}]
    defensive_20d = [r.get('ret_20d_pct') for r in classic if r.get('ticker') in {'XLV', 'XLP', 'XLU'}]
    growth_defense_spread_20d = None
    if avg(growth_20d) is not None and avg(defensive_20d) is not None:
        growth_defense_spread_20d = avg(growth_20d) - avg(defensive_20d)

    growth_1m = [r.get('ret_1m_pct') for r in classic if r.get('ticker') in {'XLK', 'XLC', 'XLY'}]
    defensive_1m = [r.get('ret_1m_pct') for r in classic if r.get('ticker') in {'XLV', 'XLP', 'XLU'}]
    growth_defense_spread_1m = None
    if avg(growth_1m) is not None and avg(defensive_1m) is not None:
        growth_defense_spread_1m = avg(growth_1m) - avg(defensive_1m)

    latest_dates = [r.get('observed_date') for r in priced if r.get('observed_date')]
    as_of_date = max(latest_dates) if latest_dates else None

    out = {
        'schema': 'JJOONI_OBSERVATORY_SECTOR_ETF_V1',
        'generated_kst': datetime.now(KST).isoformat(timespec='seconds'),
        'as_of_date': as_of_date,
        'read_only': True,
        'contains_account_data': False,
        'universe_version': 'SONG_SECTOR_UNIVERSE_V1',
        'source_contract': 'YAHOO_PUBLIC_COMPLETED_DAILY_REFERENCE',
        'horizons_sessions': list(HORIZONS),
        'benchmarks': {
            ticker: {'ticker': ticker, 'name': name, **(bm_metrics.get(ticker) or {}), 'source': 'Yahoo public daily'}
            for ticker, name in BENCHMARKS.items()
        },
        'summary': {
            'classic_count': len(classic),
            'priced_count': len(priced),
            'total_count': len(all_rows),
            'classic_above_ma20': len(above_ma20),
            'leaders_20d_rs_spy': [{'ticker': r['ticker'], 'value': r['rs_spy_20d_pct']} for r in ranked_20d[:3]],
            'laggards_20d_rs_spy': [{'ticker': r['ticker'], 'value': r['rs_spy_20d_pct']} for r in ranked_20d[-3:][::-1]],
            'growth_defense_spread_20d_pct': rounded(growth_defense_spread_20d),
            'leaders_1m_rs_spy': [{'ticker': r['ticker'], 'value': r['rs_spy_1m_pct']} for r in ranked_1m[:3]],
            'laggards_1m_rs_spy': [{'ticker': r['ticker'], 'value': r['rs_spy_1m_pct']} for r in ranked_1m[-3:][::-1]],
            'growth_defense_spread_1m_pct': rounded(growth_defense_spread_1m),
        },
        'groups': group_payload,
        'series': {ticker: (points[-130:] if points else []) for ticker, points in series.items()},
        'quality': {
            'fetch_error_count': len(fetch_errors),
            'fetch_errors': fetch_errors,
            'expected_classic_count': 11,
            'classic_priced_count': len([r for r in classic if r.get('price') is not None]),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return out


def main():
    out = build()
    print('OBSERVATORY_SECTOR_ETF_BUILD=PASS')
    print('generated_kst=' + out['generated_kst'])
    print('as_of_date=' + str(out.get('as_of_date')))
    print('horizons=' + ','.join(str(x) for x in out.get('horizons_sessions', [])))
    print('classic=' + str(out['quality']['classic_priced_count']) + '/11')
    print('priced=' + str(out['summary']['priced_count']) + '/' + str(out['summary']['total_count']))
    print('fetch_errors=' + str(out['quality']['fetch_error_count']))


if __name__ == '__main__':
    main()
