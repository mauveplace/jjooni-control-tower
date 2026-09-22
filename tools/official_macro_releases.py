"""Bounded, independently failing official release adapters.

Discovery is repeated on every refresh. Observations and dated projections have
separate contracts; a verified older publication cannot silently masquerade as new.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
import io
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from pypdf import PdfReader

KST = ZoneInfo('Asia/Seoul')
FED_CALENDAR = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
BOK_RSS = 'https://www.bok.or.kr/portal/bbs/P0002359/news.rss'
EMPLOYMENT_LIST = 'https://mods.go.kr/board.es?mid=a10301030200&bid=210'
CUSTOMS_LIST = 'https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891'


class SourceClient:
    def __init__(self, budget=65):
        self.deadline = time.monotonic() + budget

    def read(self, url):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('OFFICIAL_RELEASE_BUDGET_EXCEEDED')
        request = urllib.request.Request(urllib.parse.quote(url, safe=':/?&=%'), headers={'User-Agent': 'Mozilla/5.0 JJOONI-Official-Macro/2.0'})
        with urllib.request.urlopen(request, timeout=min(12, remaining)) as response:
            data = response.read(20_000_001)
        if len(data) > 20_000_000:
            raise ValueError('OFFICIAL_RELEASE_SIZE_LIMIT')
        return data

    def html(self, url):
        return BeautifulSoup(self.read(url).decode('utf-8-sig', 'replace'), 'html.parser')


def compact(text):
    return re.sub(r'\s+', '', text).replace('△', '-').replace('▲', '-').replace('−', '-')


def required(pattern, text, label):
    match = re.search(pattern, text)
    if not match:
        raise ValueError('OFFICIAL_PARSE_MISSING:' + label)
    return match


def publication_date(text):
    m = required(r'(?:등록일|게시일)\s*(20\d{2})[.\-/](\d{2})[.\-/](\d{2})', text, 'publication_date')
    return date(*map(int, m.groups())).isoformat()


def period_from_title(title):
    m = required(r'(20\d{2}|\d{2})\s*년\s*(\d{1,2})\s*월', title, 'reference_period')
    year = int(m[1])
    return f'{year + 2000 if year < 100 else year}-{int(m[2]):02d}-01'


def payload(key, name, group, institution, period, value, url, published, unit='%', forecast=False, **extra):
    checked = datetime.now(KST).isoformat(timespec='seconds')
    point = dict(period=period, value=value, source_url=url, published_date=published, source_tier='OFFICIAL', checked_kst=checked)
    return dict(key=key, name=name, country='US' if key.startswith('US_') else 'KR', group=group,
                frequency='publication' if forecast else 'monthly', unit=unit, status='LIVE',
                value_role='official_forecast' if forecast else 'released_actual', actual_expected=not forecast,
                source_tier='OFFICIAL', verification_status='OFFICIAL_RELEASE_PARSED', checked_kst=checked,
                source_url=url, published_date=published, history=[point], latest=point,
                primary_source=dict(institution=institution, name=institution, url=url),
                transport_source=dict(provider='Official release', url=url),
                release=dict(actual=None if forecast else value, forecast=value if forecast else None,
                             consensus=None, surprise=None, previous=None, measure=unit,
                             source_url=url, source_tier='OFFICIAL', checked_kst=checked,
                             reference_period=period, published_date=published), **extra)


def parse_sep(soup, url):
    published_raw = required(r'fomcprojtabl(\d{8})\.htm', url, 'SEP date')[1]
    published = datetime.strptime(published_raw, '%Y%m%d').date().isoformat()
    table = next((t for t in soup.select('table') if 'Federal funds rate' in t.get_text() and 'Central Tendency' in t.get_text()), None)
    if table is None:
        raise ValueError('OFFICIAL_PARSE_MISSING:SEP table')
    rows = [[c.get_text(' ', strip=True) for c in row.find_all(['th', 'td'], recursive=False)] for row in table.select('tr')]
    headers = next((r for r in rows if r and re.fullmatch(r'20\d{2}', r[0])), [])
    if 'Longer run' not in headers:
        raise ValueError('OFFICIAL_PARSE_MISSING:SEP horizons')
    horizons = headers[:headers.index('Longer run') + 1]
    projections = {}
    for label, key in [('Change in real GDP', 'gdp'), ('Unemployment rate', 'unemployment'), ('PCE inflation', 'pce'), ('Core PCE inflation', 'core_pce'), ('Federal funds rate', 'fed_funds')]:
        row = next((r for r in rows if r and r[0].startswith(label)), None)
        if not row or len(row) < len(horizons) + 1:
            raise ValueError('OFFICIAL_PARSE_MISSING:SEP ' + label)
        projections[key] = {h: float(v) for h, v in zip(horizons, row[1:]) if re.fullmatch(r'-?\d+(?:\.\d+)?', v)}
    horizon = horizons[0]
    return payload('US_SEP_DOT_PLOT', 'SEP / 금리 점도표 중앙값', 'fed', 'FED', published,
                   projections['fed_funds'][horizon], url, published, forecast=True,
                   forecast_horizon=horizon, projections=projections,
                   note='FOMC 참여자 전망 중앙값. 확정 정책금리나 시장 컨센서스가 아닙니다. 연도별 전망은 projections에 보존합니다.')


def collect_sep():
    client = SourceClient()
    soup = client.html(FED_CALENDAR)
    links = sorted({urllib.parse.urljoin(FED_CALENDAR, a['href']) for a in soup.select('a[href]')
                    if re.search(r'fomcprojtabl\d{8}\.htm$', a['href'])}, reverse=True)
    if not links:
        raise ValueError('OFFICIAL_DISCOVERY_EMPTY:SEP')
    # Never fall back to an older projection if the newest one fails to parse.
    return [parse_sep(client.html(links[0]), links[0])]


def parse_employment(soup, url):
    text = (soup.select_one('#content') or soup).get_text(' ', strip=True)
    period = period_from_title(required(r'(?:20)?\d{2}\s*년\s*\d{1,2}\s*월\s*고용동향', text, 'employment title')[0])
    t = compact(text)
    m = required(r'취업자는([\d,]+)천명으로전년동월대비(?:(\d+)만)?(?:(\d+)천)?명\([^)]*\)(증가|감소)', t, 'employment YoY change')
    change = (int(m[2] or 0) * 10 + int(m[3] or 0)) * (-1 if m[4] == '감소' else 1)
    fields = {'employed_thousands': float(m[1].replace(',', ''))}
    for key, pattern in [('employment_rate_15_64', r'15[~∼]64세고용률\(OECD비교기준\)은([\d.]+)%'), ('unemployment_rate_sa', r'계절조정실업률은([\d.]+)%')]:
        found = re.search(pattern, t)
        if found:
            fields[key] = float(found[1])
    return payload('KR_EMPLOYMENT', '취업자 전년동월대비 증감', 'labor', 'KOSTAT', period, change, url,
                   publication_date(text), unit='K YoY', components=fields)


def collect_employment():
    client = SourceClient()
    soup = client.html(EMPLOYMENT_LIST)
    candidates = []
    for a in soup.select('a.board_link'):
        title = a.get_text(' ', strip=True)
        if not re.fullmatch(r'(?:20)?\d{2}년\s*\d{1,2}월\s*고용동향', title):
            continue
        m = re.search(r'list_no=(\d+)', a.get('href', ''))
        if m:
            candidates.append((period_from_title(title), 'https://mods.go.kr/board.es?mid=a10301030200&bid=210&act=view&list_no=' + m[1]))
    if not candidates:
        raise ValueError('OFFICIAL_DISCOVERY_EMPTY:employment')
    url = max(candidates)[1]
    return [parse_employment(client.html(url), url)]


def parse_bok_outlook(text, url, published):
    # Summary table includes the last actual year, then forecast years marked e).
    years = required(r'(20\d{2})\s+(20\d{2})e\)\s+(20\d{2})e\)', text, 'BOK forecast years').groups()[1:]
    projections = {}
    for label, key in [('GDP 성장률', 'gdp'), ('소비자물가 상승률', 'cpi'), ('근원물가', 'core_cpi')]:
        m = required(re.escape(label) + r'\s+[-\d.]+\s+([-\d.]+)\([^)]*\)\s+([-\d.]+)\([^)]*\)', text, 'BOK ' + key)
        projections[key] = dict(zip(years, map(float, m.groups())))
    return payload('KR_BOK_OUTLOOK', '한국은행 경제성장률 전망', 'growth', 'BOK', published,
                   projections['gdp'][years[0]], url, published, forecast=True,
                   forecast_horizon=years[0], projections=projections,
                   note='한국은행 공식 전망. GDP 실제 발표치와 구분하며 연도별 GDP·CPI·근원 CPI 전망을 보존합니다.')


def collect_bok_outlook():
    client = SourceClient()
    root = ET.fromstring(client.read(BOK_RSS))
    candidates = []
    for item in root.findall('.//item'):
        title = item.findtext('title') or ''
        link = item.findtext('link') or ''
        if re.search(r'경제전망보고서\s*\(\s*20\d{2}년', title) and 'bok.or.kr/' in link:
            candidates.append((period_from_title(title), link))
    if not candidates:
        raise ValueError('OFFICIAL_DISCOVERY_EMPTY:BOK outlook RSS')
    url = max(candidates)[1]
    soup = client.html(url)
    text = (soup.select_one('#content') or soup).get_text(' ', strip=True)
    published = publication_date(text)
    pdf = next((urllib.parse.urljoin(url, a['href']) for a in soup.select('a[href]')
                if '경제전망보고서' in a.get_text() and '.pdf' in a['href']), None)
    if not pdf:
        raise ValueError('OFFICIAL_DISCOVERY_EMPTY:BOK outlook PDF')
    reader = PdfReader(io.BytesIO(client.read(pdf)))
    text = '\n'.join(p.extract_text() or '' for p in reader.pages[:15])
    result = parse_bok_outlook(text, url, published)
    result['attachment_url'] = pdf
    return [result]


def customs_links(soup):
    out = []
    for a in soup.select('a[data-id][data-url], a[onclick]'):
        title = a.get_text(' ', strip=True)
        if '수출입' not in title or '현황' not in title:
            continue
        m = re.search(r"goDetail\([^,]+,\s*'(\d+)',\s*'([a-f0-9]+)'", a.get('onclick', ''))
        pair = (a.get('data-id'), a.get('data-url')) if a.get('data-id') else (m.groups() if m else None)
        if pair:
            url = f'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn={pair[0]}&nttSnUrl={pair[1]}'
            out.append((title, url))
    return out


def parse_customs(soup, url, early=False):
    text = soup.get_text(' ', strip=True)
    t = compact(text)
    period = period_from_title(text)
    published = publication_date(text)
    if early:
        required(r'1일[~∼～-](?:\d+월)?20일수출입현황', t, '1–20 window')
        # Table header and period contract must not allow a 1–10 report here.
        m = required(r'전년동기대비수출([+-]?\d+(?:\.\d+)?)%', t, 'early export YoY')
        return [payload('KR_EXPORT_1_20', '1~20일 수출 YoY', 'exports', 'KCS', period, float(m[1]), url, published,
                        window='DAY_1_TO_20', revision_status='PRELIMINARY')]
    required(r'월간수출입현황\[확정치\]', t, 'confirmed monthly window')
    total = float(required(r'전년동월대비수출은([+-]?\d+(?:\.\d+)?)%', t, 'monthly export YoY')[1])
    semi = float(required(r'반도체\(전년동월대비증감률([+-]?\d+(?:\.\d+)?)%', t, 'semiconductor export YoY')[1])
    results = []
    for key, name, value, label in [('KR_EXPORT_YOY', '월간 수출 YoY', total, '수출'), ('KR_SEMICON_EXPORT_YOY', '반도체 월간 수출 YoY', semi, '반도체')]:
        metric = payload(key, name, 'exports', 'KCS', period, value, url, published, revision_status='MONTHLY_CONFIRMED')
        # Official release's explicit same-year monthly series provides initial
        # backfill; no interpolation or borrowing from another commodity.
        series = re.search(label + r'전년동월대비증감률\(%\):\[([’\'‘]?\d{2})\.(\d+)월\]([^*○※]+)', t)
        if series:
            year = 2000 + int(re.sub(r'\D', '', series[1]))
            fragment = '[' + series[2] + '월]' + series[3]
            points = []
            for mm, vv in re.findall(r'\[(\d{1,2})월\]([+-]?\d+(?:\.\d+)?)', fragment):
                points.append(dict(metric['latest'], period=f'{year}-{int(mm):02d}-01', value=float(vv)))
            if points and points[-1]['period'] == period and points[-1]['value'] == value:
                metric['history'] = points
        results.append(metric)
    return results


def collect_customs():
    client = SourceClient()
    found = {}
    for page in range(1, 5):
        soup = client.html(CUSTOMS_LIST + f'&currPage={page}')
        for title, url in customs_links(soup):
            t = compact(title)
            if '월간수출입현황[확정치]' in t:
                found.setdefault('monthly', url)
            if re.search(r'1일[~∼～-](?:\d+월)?20일수출입현황', t):
                found.setdefault('early', url)
        if len(found) == 2:
            break
    results = []
    for kind in ['monthly', 'early']:
        if kind not in found:
            raise ValueError('OFFICIAL_DISCOVERY_EMPTY:customs ' + kind)
        results.extend(parse_customs(client.html(found[kind]), found[kind], early=kind == 'early'))
    return results


RELEASE_ADAPTERS = {
    'SEP': (collect_sep, [('US_SEP_DOT_PLOT', 'SEP / Dot Plot', 'FED')]),
    'BOK_OUTLOOK': (collect_bok_outlook, [('KR_BOK_OUTLOOK', '한국은행 경제전망', 'BOK')]),
    'EMPLOYMENT': (collect_employment, [('KR_EMPLOYMENT', '고용', 'KOSTAT')]),
    'CUSTOMS': (collect_customs, [('KR_EXPORT_YOY', '월간 수출 YoY', 'KCS'), ('KR_SEMICON_EXPORT_YOY', '반도체 월간 수출 YoY', 'KCS'), ('KR_EXPORT_1_20', '1~20일 수출 YoY', 'KCS')]),
}


def freshness_error(metric, today):
    if metric.get('value_role') == 'official_forecast':
        age = (today - date.fromisoformat(metric['published_date'])).days
        return 'OFFICIAL_PUBLICATION_STALE' if age > 120 else None
    period = date.fromisoformat(metric['latest']['period'])
    expected = today.replace(day=1)
    cutoff = 22 if metric['key'] == 'KR_EXPORT_1_20' else 17
    if metric['key'] != 'KR_EXPORT_1_20' or today.day < cutoff:
        expected = (expected - timedelta(days=1)).replace(day=1)
    if metric['key'] != 'KR_EXPORT_1_20' and today.day < cutoff:
        expected = (expected - timedelta(days=1)).replace(day=1)
    return 'OFFICIAL_REFERENCE_PERIOD_OVERDUE' if period < expected else None


def collect_releases(previous, today=None):
    today = today or datetime.now(KST).date()
    metrics, errors = {}, {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {name: pool.submit(adapter[0]) for name, adapter in RELEASE_ADAPTERS.items()}
        for name, future in futures.items():
            try:
                for metric in future.result():
                    key = metric['key']
                    old = (previous.get('metrics') or {}).get(key, {})
                    # Only the same release contract can extend a history. ECOS
                    # export raw amounts are handled separately by the caller.
                    history = old.get('history', []) if old.get('verification_status') == 'OFFICIAL_RELEASE_PARSED' else []
                    points = {p['period']: p for p in history + metric['history'] if p.get('value') is not None}
                    metric['history'] = [points[p] for p in sorted(points)]
                    metric['latest'] = metric['history'][-1]
                    earlier = [p for p in metric['history'] if p['period'] < metric['latest']['period']]
                    metric['release']['previous'] = earlier[-1]['value'] if earlier else None
                    stale = freshness_error(metric, today)
                    if stale:
                        metric.update(status='DEGRADED', error=stale)
                        errors[key] = stale
                    metrics[key] = metric
            except Exception as exc:
                for key, label, institution in RELEASE_ADAPTERS[name][1]:
                    errors[key] = f'{type(exc).__name__}:{exc}'
                    metrics[key] = dict(key=key, name=label, country='US' if key.startswith('US_') else 'KR',
                                        status='DEGRADED', history=[], latest=None, error=errors[key],
                                        primary_source=dict(institution=institution))
                print(f'OFFICIAL_RELEASE_FAILED adapter={name} error={type(exc).__name__}:{exc}', flush=True)
    return metrics, errors
