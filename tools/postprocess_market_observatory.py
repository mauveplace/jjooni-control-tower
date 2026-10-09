#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OBS = ROOT / 'market-observatory' / 'data' / 'observatory.json'
CAL = ROOT / 'market-observatory' / 'data' / 'economic-calendar.json'
PULSE = ROOT / 'market-observatory' / 'data' / 'daily-market-pulse.json'
PUBLIC = ROOT / 'public-market-daily.json'
KST = ZoneInfo('Asia/Seoul')
ET = ZoneInfo('America/New_York')
UA = 'Mozilla/5.0 JJOONI-Market-Observatory-Post/1.2'
KR = {
    'KR3Y': '010200000',
    'KR5Y': '010200001',
    'KR10Y': '010210000',
    'KR20Y': '010220000',
    'KR30Y': '010230000',
}
CNN_FG = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'


def get_json(url):
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': UA,
            'Accept': 'application/json,text/plain,*/*',
            'Origin': 'https://www.cnn.com',
            'Referer': 'https://www.cnn.com/',
        },
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def get_text(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml'},
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode('utf-8', 'ignore')


def read_json(path: Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {} if fallback is None else fallback


def as_number(value):
    try:
        value = float(value)
    except Exception:
        return None
    return value if value == value and value not in (float('inf'), float('-inf')) else None


def ecos_page(item, start, end, pos, last, key):
    url = f'https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/{pos}/{last}/817Y002/D/{start}/{end}/{item}'
    return get_json(url).get('StatisticSearch') or {}


def ecos_series(item, start, end, key='sample', cap=400):
    size = 10 if key == 'sample' else 1000
    pos = 1
    rows = []
    total = None
    while pos <= cap:
        block = ecos_page(item, start, end, pos, pos + size - 1, key)
        batch = block.get('row') or []
        if total is None:
            try:
                total = int(block.get('list_total_count') or 0)
            except Exception:
                total = 0
        rows.extend(batch)
        if not batch or pos + size > total:
            break
        pos += size
    out = []
    for r in rows:
        try:
            v = float(r.get('DATA_VALUE'))
        except Exception:
            continue
        t = str(r.get('TIME') or '')
        if len(t) == 8:
            t = f'{t[:4]}-{t[4:6]}-{t[6:8]}'
        if len(t) == 10:
            out.append({'date': t, 'value': v})
    ded = {x['date']: x for x in out}
    return [ded[k] for k in sorted(ded)]


def merge(a, b):
    d = {x['date']: x for x in (a or [])}
    d.update({x['date']: x for x in (b or [])})
    return [d[k] for k in sorted(d)]


def patch_rates(o):
    key = os.getenv('BOK_ECOS_API_KEY') or 'sample'
    now = datetime.now(KST)
    s = o.setdefault('series', {})
    latest = o.setdefault('latest', {})
    first = not bool(s.get('KR3Y'))
    start = (now - timedelta(days=370 if first else 45)).strftime('%Y%m%d')
    end = now.strftime('%Y%m%d')
    errors = {}
    for name, item in KR.items():
        try:
            fresh = ecos_series(item, start, end, key, cap=320 if first else 80)
            if fresh:
                s[name] = merge(s.get(name), fresh)
            latest[name] = s[name][-1]['value'] if s.get(name) else None
        except Exception as exc:
            errors[name] = type(exc).__name__
    if s.get('KR3Y') and s.get('KR10Y'):
        a = {x['date']: x['value'] for x in s['KR10Y']}
        b = {x['date']: x['value'] for x in s['KR3Y']}
        s['KR_3S10S'] = [
            {'date': d, 'value': round(a[d] - b[d], 8)}
            for d in sorted(set(a) & set(b))
        ]
        latest['KR_3S10S'] = s['KR_3S10S'][-1]['value'] if s['KR_3S10S'] else None
    us = latest.get('US10Y_OFFICIAL') or latest.get('US10Y')
    if latest.get('KR10Y') is not None and us is not None:
        latest['KR_US_10Y'] = round(latest['KR10Y'] - us, 8)
    o.setdefault('quality', {})['kr_rates'] = {
        'state': 'PASS' if latest.get('KR10Y') is not None else 'UNAVAILABLE',
        'source': 'BOK_ECOS',
        'window': '1Y_BACKFILL_THEN_45D_INCREMENT',
        'errors': errors,
    }


def cnn_fear_greed_snapshot():
    obj = get_json(CNN_FG)
    block = (obj or {}).get('fear_and_greed') or {}
    score = as_number(block.get('score'))
    if score is None or not 0 <= score <= 100:
        raise RuntimeError('CNN_FEAR_GREED_SCORE_MISSING')
    return {
        'value': score,
        'prev_close': as_number(block.get('previous_close')),
        'rating': str(block.get('rating') or '').upper() or None,
        'observed_at': block.get('timestamp'),
        'source': 'CNN_FEAR_GREED_PUBLIC',
        'data_state': 'LIVE',
    }


def build_fear_greed_series(o, public=None, pulse=None, current=None):
    public = public or {}
    pulse = pulse or {}
    points = {}

    for row in pulse.get('history') or []:
        d = str(row.get('market_date_us') or '')[:10]
        value = as_number(row.get('fear_greed'))
        if len(d) == 10 and value is not None:
            points[d] = {'date': d, 'value': round(value, 6)}

    public_item = (((public.get('market_context') or {}).get('items') or {}).get('FEAR_GREED') or {})
    current = current or public_item
    current_value = as_number((current or {}).get('value'))
    current_date = (
        str(o.get('us_completed_session_date') or '')[:10]
        or str(pulse.get('market_date_us') or '')[:10]
        or str((current or {}).get('as_of_date') or '')[:10]
        or str((current or {}).get('observed_at') or (current or {}).get('as_of_kst') or '')[:10]
    )
    if current_value is not None and len(current_date) == 10:
        points[current_date] = {'date': current_date, 'value': round(current_value, 6)}

    return [points[k] for k in sorted(points)][-800:]


def patch_fear_greed(o):
    public = read_json(PUBLIC, {})
    pulse = read_json(PULSE, {})
    direct = None
    error = None
    try:
        direct = cnn_fear_greed_snapshot()
    except Exception as exc:
        error = type(exc).__name__

    public_item = (((public.get('market_context') or {}).get('items') or {}).get('FEAR_GREED') or {})
    current = direct or public_item
    rows = build_fear_greed_series(o, public, pulse, current)
    value = as_number((current or {}).get('value'))

    series = o.setdefault('series', {})
    latest = o.setdefault('latest', {})
    quality = o.setdefault('quality', {})
    if rows:
        series['FEAR_GREED'] = rows
        latest['FEAR_GREED'] = rows[-1]['value']
    elif value is not None:
        latest['FEAR_GREED'] = value

    rating = (current or {}).get('rating')
    if rating:
        latest['FEAR_GREED_RATING'] = rating

    state = 'LIVE' if direct else (
        'STALE_FALLBACK'
        if str(public_item.get('data_state') or '').upper() == 'STALE_FALLBACK'
        else ('FALLBACK' if value is not None else 'UNAVAILABLE')
    )
    quality['fear_greed'] = {
        'state': state,
        'source': (current or {}).get('source') or 'CNN_FEAR_GREED_PUBLIC',
        'observed_at': (current or {}).get('observed_at') or (current or {}).get('as_of_kst'),
        'rating': rating,
        'error': error,
        'history_source': 'DAILY_MARKET_PULSE_HISTORY',
        'contract': 'CNN_PRIMARY_PUBLIC_SIDECAR_FALLBACK_V1',
    }
    o['fear_greed_contract'] = 'CNN_PRIMARY_PUBLIC_SIDECAR_FALLBACK_V1'


def _aligned_pulse(o, pulse):
    obs_date = str(o.get('us_completed_session_date') or '')[:10]
    pulse_date = str(pulse.get('market_date_us') or '')[:10]
    return bool(obs_date and pulse_date and obs_date == pulse_date)


def build_today_strategy(o, pulse=None):
    pulse = pulse or {}
    t = o.get('tripod_latest') or {}
    target = str(t.get('target') or '')
    regime = str(t.get('regime') or '—')
    changed = bool(t.get('target_changed') or t.get('signal_changed'))
    fg = as_number((o.get('latest') or {}).get('FEAR_GREED'))

    risk = None
    if _aligned_pulse(o, pulse):
        risk = str((pulse.get('derived') or {}).get('risk') or '') or None

    if changed:
        action_code = 'REBALANCE_CHECK'
        headline = '목표 노출 변경 — 리밸런싱 조건 확인'
        action = '완료 일봉 기준 목표 노출이 바뀌었습니다. 목표비중을 재점검하되 장 초반 추격 주문은 피하고 조건 충족 여부를 먼저 확인합니다.'
    elif '현금' in target:
        action_code = 'HOLD_DEFENSIVE'
        headline = '방어 유지 — 신규 위험노출 확대 보류'
        action = '현금 방어를 유지합니다. 상승 레짐 복귀와 변동성 조건 회복이 확인되기 전에는 위험노출 확대를 보류합니다.'
    elif 'TQQQ' in target:
        action_code = 'HOLD_RISK_ON'
        headline = '상승 레짐 유지 — 기존 노출 유지, 추격매수 자제'
        action = 'TRI-POD 목표 노출은 유지합니다. 신규 추격매수보다 기존 노출 유지가 우선이며 VIX10·52주 낙폭·MA250 레짐 훼손 여부를 감시합니다.'
    elif 'QLD' in target or 'QQQ' in target:
        action_code = 'HOLD_BALANCED'
        headline = '중간 노출 유지 — 레버리지 확대는 조건 확인 후'
        action = '중간 노출을 유지합니다. 변동성 또는 레짐이 다시 개선되기 전에는 레버리지 확대를 서두르지 않습니다.'
    else:
        action_code = 'CHECK_INPUTS'
        headline = '입력 확인 — TRI-POD 목표 노출 재검증'
        action = 'TRI-POD 목표 노출을 확정할 입력이 부족합니다. 완료 일봉과 VIX10 정합성을 확인하기 전에는 포지션 변경 판단을 보류합니다.'

    risk_flags = []
    if risk == 'RISK_OFF':
        risk_flags.append('단기 시장 펄스가 RISK_OFF이므로 신규 확대는 한 단계 보수적으로 확인')
    elif risk == 'RISK_ON':
        risk_flags.append('단기 시장 펄스는 RISK_ON이지만 TRI-POD 목표가 우선')

    if fg is not None and fg <= 24:
        risk_flags.append('Fear & Greed가 극단적 공포 구간이므로 변동성 확대 가능성 점검')
    elif fg is not None and fg >= 76:
        risk_flags.append('Fear & Greed가 극단적 탐욕 구간이므로 추격매수 경계')

    guardrails = {
        'ma250_regime': regime,
        'target': target or None,
        'vix10': as_number(t.get('vix10')),
        'vix10_risk_on_limit': 28.0 if regime == '상승' else 18.0,
        'drawdown_52w_pct': as_number(t.get('drawdown_52w_pct')),
        'risk_on_drawdown_limit_pct': -9.0 if regime == '상승' else None,
        'fear_greed': fg,
        'market_pulse_risk': risk,
    }
    session_date = str(o.get('us_completed_session_date') or t.get('date') or '')[:10] or None
    return {
        'schema': 'JJOONI_OBSERVATORY_TODAY_STRATEGY_V1',
        'date': session_date,
        'regime': regime,
        'target': target or None,
        'action_code': action_code,
        'headline': headline,
        'action': action,
        'risk_flags': risk_flags,
        'guardrails': guardrails,
        'pulse_aligned': _aligned_pulse(o, pulse),
        'read_only': True,
        'autobot_direct_trade_trigger': False,
        'source_contract': 'TRIPOD_CANONICAL_PLUS_ALIGNED_MARKET_PULSE_V1',
    }


def patch_today_strategy(o):
    pulse = read_json(PULSE, {})
    strategy = build_today_strategy(o, pulse)
    o['today_strategy'] = strategy
    o['today_strategy_contract'] = 'TRIPOD_CANONICAL_DECISION_SUPPORT_V1'

    log = [
        x for x in (o.get('signal_log') or [])
        if not (isinstance(x, dict) and x.get('kind') == 'DAILY_ACTION')
    ]
    log.append({
        'kind': 'DAILY_ACTION',
        'date': strategy.get('date') or datetime.now(KST).date().isoformat(),
        'regime': '오늘 대응',
        'target': strategy.get('headline'),
        'reason': strategy.get('action'),
        'risk_flags': strategy.get('risk_flags') or [],
    })
    o['signal_log'] = log[-100:]


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append(re.sub(r'\s+', ' ', ' '.join(self.cell)).strip())
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if any(self.row):
                self.rows.append(self.row)
            self.row = None
            self.cell = None


DATE_RE = re.compile(
    r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2})\s+(20\d{2})',
    re.I,
)


def _te_rows(slug, code):
    txt = get_text(f'https://tradingeconomics.com/{slug}/calendar')
    p = _TableParser()
    p.feed(txt)
    out = []
    current = None
    for cells in p.rows:
        joined = ' '.join(cells)
        m = DATE_RE.search(joined)
        if m:
            try:
                current = datetime.strptime(
                    f'{m.group(2)} {m.group(3)} {m.group(4)}',
                    '%B %d %Y',
                ).date().isoformat()
            except Exception:
                current = None
            if len(cells) <= 2:
                continue
        if not current:
            continue
        idx = next(
            (i for i, x in enumerate(cells) if x.strip().upper() == code),
            None,
        )
        if idx is None:
            continue
        tail = [x.strip() for x in cells[idx + 1:]]
        if not tail:
            continue
        event = tail[0]
        # Calendar table contract: Event | Actual | Previous | Consensus | Forecast.
        vals = (tail[1:] + ['', '', '', ''])[:4]
        out.append({
            'date': current,
            'event': event,
            'actual': vals[0],
            'previous': vals[1],
            'consensus': vals[2],
            'forecast': vals[3],
        })
    return out


def _norm(s):
    return re.sub(r'[^a-z0-9가-힣]+', ' ', str(s).lower()).strip()


def _date_near(a, b):
    try:
        return abs((datetime.fromisoformat(a).date() - datetime.fromisoformat(b).date()).days) <= 1
    except Exception:
        return False


METRIC_RULES = [
    (('consumer price index', '소비자물가동향'), ['Inflation Rate YoY', 'Core Inflation Rate YoY']),
    (('producer price index', '생산자물가지수'), ['PPI YoY', 'Core PPI YoY']),
    (('employment situation',), ['Non Farm Payrolls', 'Unemployment Rate']),
    (('job openings', 'jolts'), ['Job Openings']),
    (('personal income and outlays',), ['Core PCE Price Index YoY', 'PCE Price Index YoY', 'Personal Spending MoM']),
    (('gdp', '실질 gdp'), ['GDP Growth Rate QoQ', 'GDP Growth Rate YoY']),
    (('산업활동동향',), ['Industrial Production YoY', 'Industrial Production MoM']),
    (('고용동향',), ['Unemployment Rate', 'Employment Change']),
    (('fomc', '통화정책방향 결정회의'), ['Interest Rate Decision', 'Fed Interest Rate Decision']),
]


def _preferred_metrics(title):
    n = _norm(title)
    for needles, metrics in METRIC_RULES:
        if any(_norm(x) in n for x in needles):
            return metrics
    return []


def _find_metric(rows, date_value, name):
    nn = _norm(name)
    best = None
    for r in rows:
        if not _date_near(date_value, r['date']):
            continue
        ev = _norm(r['event'])
        score = 0
        if nn == ev:
            score = 100
        elif nn in ev or ev in nn:
            score = 80
        else:
            a = set(nn.split())
            b = set(ev.split())
            score = len(a & b) * 10
        if score and (best is None or score > best[0]):
            best = (score, r)
    return best[1] if best else None


def enrich_market_expectations(c):
    rows = {}
    errors = {}
    for country, slug, code in [
        ('US', 'united-states', 'US'),
        ('KR', 'south-korea', 'KR'),
    ]:
        try:
            rows[country] = _te_rows(slug, code)
        except Exception as exc:
            rows[country] = []
            errors[country] = type(exc).__name__
    enriched = 0
    for e in c.get('events') or []:
        country = e.get('country')
        date_value = str(e.get('datetime_kst') or '')[:10]
        metrics = []
        for wanted in _preferred_metrics(e.get('title', '')):
            r = _find_metric(rows.get(country, []), date_value, wanted)
            if not r:
                continue
            metrics.append({
                'label': r['event'],
                'actual': r['actual'] or None,
                'previous': r['previous'] or None,
                'consensus': r['consensus'] or None,
                'forecast': r['forecast'] or None,
                'source': 'Trading Economics',
            })
        if metrics:
            e['market_metrics'] = metrics[:3]
            first = metrics[0]
            e['actual'] = first.get('actual')
            e['consensus'] = first.get('consensus')
            e['previous'] = first.get('previous')
            e['expectations_source'] = 'Trading Economics'
            enriched += 1
    c.setdefault('quality', {})['market_expectations'] = {
        'state': 'PASS' if enriched else ('DEGRADED' if errors else 'NO_MATCH'),
        'source': 'Trading Economics public calendar',
        'enriched_events': enriched,
        'errors': errors,
        'contract': 'official schedule + market consensus overlay',
    }
    if 'Trading Economics' not in c.setdefault('sources', []):
        c['sources'].append('Trading Economics')


def patch_calendar(c):
    events = c.get('events') or []
    # Correct FOMC statement timestamps: 2 p.m. ET on second meeting day -> KST with DST.
    fomc = [
        '2026-01-28',
        '2026-03-18',
        '2026-04-29',
        '2026-06-17',
        '2026-07-29',
        '2026-09-16',
        '2026-10-28',
        '2026-12-09',
    ]
    bydate = {
        d: datetime.strptime(d + ' 14:00', '%Y-%m-%d %H:%M')
        .replace(tzinfo=ET)
        .astimezone(KST)
        .isoformat(timespec='minutes')
        for d in fomc
    }
    for e in events:
        if e.get('source') == 'Federal Reserve' and 'FOMC' in e.get('title', ''):
            raw = str(e.get('datetime_kst') or '')[:10]
            if raw in bydate:
                e['datetime_kst'] = bydate[raw]
    y = datetime.now(KST).year
    lo = f'{y}-01-01'
    hi = f'{y + 1}-12-31'
    events = [
        e for e in events
        if lo <= str(e.get('datetime_kst') or '')[:10] <= hi
    ]
    events.sort(key=lambda e: e.get('datetime_kst') or '')
    c['events'] = events
    c['generated_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    c['time_contract'] = 'ALL_TIMES_KST'
    c['importance_contract'] = '3=market_moving,2=major,1=reference'
    enrich_market_expectations(c)


def patch_freshness(o):
    now = datetime.now(KST)
    o['freshness'] = {
        'status': 'LIVE',
        'checked_kst': now.isoformat(timespec='seconds'),
        'market_date_us': o.get('us_completed_session_date'),
        'us_close_refresh_contract': 'US_REGULAR_CLOSE_PLUS_10M_DST_AWARE',
        'scheduled_kst': '05:10_OR_06:10_DST_DEPENDENT',
        'watchdog_contract': 'DELAY_TOLERANT_CLOSE_SELF_HEAL',
        'fear_greed_state': ((o.get('quality') or {}).get('fear_greed') or {}).get('state'),
        'today_strategy': bool(o.get('today_strategy')),
    }


def main():
    o = json.loads(OBS.read_text(encoding='utf-8'))
    c = json.loads(CAL.read_text(encoding='utf-8'))
    patch_rates(o)
    patch_fear_greed(o)
    patch_today_strategy(o)
    patch_freshness(o)
    patch_calendar(c)
    o['generated_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(
        json.dumps(o, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    CAL.write_text(
        json.dumps(c, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    q = (c.get('quality') or {}).get('market_expectations') or {}
    fgq = (o.get('quality') or {}).get('fear_greed') or {}
    strategy = o.get('today_strategy') or {}
    print('MARKET_OBSERVATORY_POSTPROCESS=PASS')
    print(
        'KR10Y=', o.get('latest', {}).get('KR10Y'),
        'KR3S10S=', o.get('latest', {}).get('KR_3S10S'),
        'FEAR_GREED=', o.get('latest', {}).get('FEAR_GREED'),
        'fear_greed_state=', fgq.get('state'),
        'strategy=', strategy.get('action_code'),
        'calendar=', len(c.get('events') or []),
        'expectations=', q.get('enriched_events', 0),
    )


if __name__ == '__main__':
    main()
