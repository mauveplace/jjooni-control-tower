"""Publish market-only TRI-POD comparison inputs from completed US sessions."""
import json
import math
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from build_market_observatory import ET, get_json, tripod_history

DATA = Path(__file__).resolve().parents[1] / 'market-observatory/data'
OUT = DATA / 'tripod-comparison.json'
ETFS = ('QQQ', 'QLD', 'TQQQ')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def etf_bars(symbol, range_='max'):
    query = urllib.parse.urlencode({'interval': '1d', 'range': range_, 'includePrePost': 'false'})
    for host in ('query1.finance.yahoo.com', 'query2.finance.yahoo.com'):
        try:
            chart = get_json(f'https://{host}/v8/finance/chart/{symbol}?{query}')['chart']['result'][0]
            indicators = chart['indicators']
            closes = indicators['quote'][0]['close']
            adjusted = indicators['adjclose'][0]['adjclose']
            rows = {}
            for stamp, close, adj in zip(chart['timestamp'], closes, adjusted, strict=True):
                if all(isinstance(value, (int, float)) and math.isfinite(value) and value > 0
                       for value in (close, adj)):
                    day = datetime.fromtimestamp(stamp, ET).date().isoformat()
                    rows[day] = [round(close, 6), round(adj, 6)]
            if rows:
                return rows
        except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
            print(f'TRI-POD comparison {symbol} {host}: {exc}')
    raise RuntimeError(f'Completed close/adjusted-close history unavailable for {symbol}')


def build(obs, archive, etfs):
    latest = obs['tripod_latest']
    session = obs['us_completed_session_date']
    if latest.get('ok') is not True or (latest.get('session_date') or latest.get('date')) != session:
        raise ValueError('Canonical completed TRI-POD signal unavailable')
    series = {}
    for key in ('NASDAQ100', 'VIX'):
        merged = {r['date']: r for source in (archive, obs)
                  for r in source['series'].get(key, []) if r['date'] <= session}
        series[key] = [merged[d] for d in sorted(merged)]
    replay, _ = tripod_history(series)
    signals = {r['date']: r for r in replay}
    signals.update((r['date'], r) for r in obs['tripod_history'] if r['date'] <= session)
    signals[session] = latest
    # Use the continuous common-date suffix. An interior data gap cannot be
    # treated as one trading session or silently filled with a proxy.
    completed = [item['date'] for item in series['NASDAQ100']]
    last_common = next((d for d in reversed(completed)
                        if d in signals and all(d in etfs[key] for key in ETFS)), None)
    coverage = {key: [min(etfs[key]), max(etfs[key]), len(etfs[key])] for key in ETFS}
    print(f'TRI-POD comparison source coverage: canonical={session} '
          f'last_common={last_common} ETF={coverage}')
    if last_common is None:
        raise ValueError('ETF and canonical signals share no completed sessions')
    rows = []
    for item in reversed(series['NASDAQ100']):
        day = item['date']
        if day > last_common:
            continue
        signal = signals.get(day)
        quotes = [etfs[key].get(day) for key in ETFS]
        if not signal or any(q is None for q in quotes):
            break
        rows.append([day, signal['ndx'], signal['ma250'], signal['target'], *quotes])
    rows.reverse()
    if len(rows) < 2:
        raise ValueError(f'ETF and canonical signals lack a continuous window through {last_common}')
    return {'schema': 'JJOONI_TRIPOD_COMPARISON_V1', 'session': last_common,
            'canonical_session': session, 'rows': rows}


def main():
    obs = read(DATA / 'observatory.json')
    if OUT.exists():
        previous = read(OUT)
        if (previous.get('schema') == 'JJOONI_TRIPOD_COMPARISON_V1' and
                previous.get('session', '') >= obs['us_completed_session_date']):
            print('TRI-POD comparison already has the latest completed US session')
            return
    archive = read(DATA / 'history-30y.json')
    def fetch(symbol):
        bars = etf_bars(symbol)
        if obs['us_completed_session_date'] not in bars:
            try:
                bars.update(etf_bars(symbol, '1mo'))
            except RuntimeError as exc:
                print(f'TRI-POD comparison recent check {symbol}: {exc}')
        return bars

    with ThreadPoolExecutor(max_workers=len(ETFS)) as pool:
        etfs = dict(zip(ETFS, pool.map(fetch, ETFS), strict=True))
    payload = build(obs, archive, etfs)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'TRI-POD comparison {payload["rows"][0][0]} through {payload["session"]}: {len(payload["rows"])} sessions')


if __name__ == '__main__':
    main()
