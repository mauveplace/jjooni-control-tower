#!/usr/bin/env python3
"""Capture CME's public FedWatch tables once per source day, then serve JSON."""
from __future__ import annotations
import argparse
import hashlib
import http.cookiejar
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from fedwatch_trade_calendar import _expected_latest_trade_date

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'market-observatory/data/fedwatch-official.json'
PAGE = 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html'
HOST = 'https://cmegroup-tools.quikstrike.net'
KST = ZoneInfo('Asia/Seoul')
CT = ZoneInfo('America/Chicago')
ET = ZoneInfo('America/New_York')
SOURCE_KIND = 'CME_OFFICIAL_PUBLIC_TABLE'
ROUNDING_TOLERANCE = .002


def table_rows(table):
    return [[c.get_text(' ', strip=True) for c in r.find_all(['td', 'th'], recursive=False)]
            for r in table.find_all('tr')]


def probability(value):
    if not re.fullmatch(r'\d+(?:\.\d+)?\s*%', value):
        raise ValueError('OFFICIAL_PROBABILITY_FORMAT')
    number = float(value.replace('%', '')) / 100
    if not 0 <= number <= 1:
        raise ValueError('OFFICIAL_PROBABILITY_RANGE')
    return round(number, 6)


def parse_tables(current_html, matrix_html, captured=None):
    now = captured or datetime.now(KST)
    current = BeautifulSoup(current_html, 'html.parser')
    text = current.get_text(' ', strip=True)
    stamp = re.search(r'Data as of\s+(\d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2}) CT', text)
    if not stamp:
        raise ValueError('OFFICIAL_SOURCE_TIMESTAMP_MISSING')
    asof = datetime.strptime(stamp[1], '%d %b %Y %H:%M:%S').replace(tzinfo=CT)
    # The public CT clock omits AM/PM; retain it verbatim rather than inventing
    # a precise KST conversion. Its explicit calendar date remains usable.
    if asof.date() > now.astimezone(CT).date():
        raise ValueError('OFFICIAL_SOURCE_TIMESTAMP_FUTURE')
    current_table = next((t for t in current.find_all('table')
                          if 'target rate (bps)' in t.get_text().lower() and len(t.get_text()) < 10000), None)
    if current_table is None:
        raise ValueError('OFFICIAL_CURRENT_TABLE_MISSING')
    comparison = table_rows(current_table)
    current_row = next((r for r in comparison if r and '(Current)' in r[0]), None)
    if not current_row:
        raise ValueError('OFFICIAL_CURRENT_TARGET_MISSING')
    bounds = re.search(r'(\d+)-(\d+)', current_row[0])
    lower, upper = (int(x) / 100 for x in bounds.groups())
    target = f'{lower:.2f}-{upper:.2f}'
    document = BeautifulSoup(matrix_html, 'html.parser')
    candidates = [table_rows(t) for t in document.find_all('table')]
    raw = next((r for r in candidates if any(x and x[0].upper() == 'MEETING DATE' for x in r)), None)
    if not raw:
        raise ValueError('OFFICIAL_MATRIX_MISSING')
    header = next(r for r in raw if r and r[0].upper() == 'MEETING DATE')
    ranges = []
    for cell in header[1:]:
        match = re.fullmatch(r'(\d+)-(\d+)', cell)
        if not match:
            raise ValueError('OFFICIAL_TARGET_HEADER')
        a, b = (int(x) / 100 for x in match.groups())
        ranges.append(f'{a:.2f}-{b:.2f}')
    rows = []
    for raw_row in raw:
        if not raw_row or not re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}', raw_row[0]):
            continue
        day = datetime.strptime(raw_row[0], '%m/%d/%Y').date().isoformat()
        if len(raw_row) != len(ranges) + 1:
            raise ValueError('OFFICIAL_MATRIX_COLUMNS')
        probs = {key: probability(value) for key, value in zip(ranges, raw_row[1:]) if value}
        total = sum(probs.values())
        if not probs or abs(total - 1) > ROUNDING_TOLERANCE + 1e-9:
            raise ValueError('OFFICIAL_ROUNDED_PROBABILITY_SUM')
        mode = max(probs, key=probs.get)
        above = sum(p for k, p in probs.items() if float(k.split('-')[0]) > lower)
        below = sum(p for k, p in probs.items() if float(k.split('-')[0]) < lower)
        midpoint = sum((sum(map(float, k.split('-'))) / 2) * p for k, p in probs.items()) / total
        rows.append({'meeting_date': day, 'probabilities': probs, 'most_likely_target': mode,
                     'most_likely_probability': probs[mode], 'expected_target_midpoint': round(midpoint, 6),
                     'probability_above_current': round(above, 6), 'probability_same_as_current': probs.get(target, 0),
                     'probability_below_current': round(below, 6), 'change_1d_pp': {}, 'change_1w_pp': {},
                     'conditional_move_distribution': [], 'conditional_expected_change_bp': None,
                     'probability_basis': 'CME_PUBLISHED_ROUNDED_TABLE', 'published_probability_sum': round(total, 6)})
    dates = [r['meeting_date'] for r in rows]
    if not dates or dates != sorted(set(dates)):
        raise ValueError('OFFICIAL_MEETING_ORDER')
    first = rows[0]
    # Read the current, one-day and one-week columns for the nearest meeting.
    for row in comparison:
        match = re.match(r'^(\d+)-(\d+)', row[0] if row else '')
        if not match or len(row) < 2 or not row[1]:
            continue
        a, b = (int(x) / 100 for x in match.groups())
        key = f'{a:.2f}-{b:.2f}'
        if abs(first['probabilities'].get(key, 0) - probability(row[1])) > .001 + 1e-9:
            raise ValueError('OFFICIAL_VIEWS_CHANGED_DURING_CAPTURE')
        for index, field in ((2, 'change_1d_pp'), (3, 'change_1w_pp')):
            if len(row) > index and row[index]:
                first[field][key] = round((probability(row[1]) - probability(row[index])) * 100, 3)
    outcomes = []
    for key, p in first['probabilities'].items():
        if not p:
            continue
        move = round((float(key.split('-')[0]) - lower) * 100)
        action = 'HOLD' if move == 0 else ('HIKE_' if move > 0 else 'CUT_') + str(abs(move)) + 'BP'
        outcomes.append({'action': action, 'move_bp': move, 'target': key, 'probability': p})
    expected = _expected_latest_trade_date(now.astimezone(ET)).isoformat()
    state = 'LIVE' if asof.date().isoformat() >= expected else 'LAGGING'
    evidence = {'published_as_of_text': stamp[0], 'current_comparison_rows': comparison,
                'matrix_rows': raw, 'matrix_clock_text': re.findall(r'As of\s+\d{2}:\d{2}:\d{2}', document.get_text(' ', strip=True))}
    digest = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()
    path = {'current_target_midpoint': (lower + upper) / 2,
            'terminal_meeting_date': rows[-1]['meeting_date'],
            'terminal_most_likely_target': rows[-1]['most_likely_target'],
            'terminal_expected_target_midpoint': rows[-1]['expected_target_midpoint'],
            'peak_expected_target_midpoint': max(r['expected_target_midpoint'] for r in rows),
            'first_majority_above_current': next((r['meeting_date'] for r in rows if r['probability_above_current'] >= .5), None),
            'first_majority_below_current': next((r['meeting_date'] for r in rows if r['probability_below_current'] >= .5), None)}
    return {'schema': 'JJOONI_FED_WATCH_V1', 'schema_revision': '2.0',
            'matrix_contract': 'CME_FEDWATCH_CONDITIONAL_MEETING_PROBABILITY_MATRIX_V2',
            'source_kind': SOURCE_KIND, 'source': 'CME FedWatch official public probability tables (QuikStrike)',
            'source_priority': 'CME_OFFICIAL_PUBLIC_PRIMARY', 'official_api_status': 'PUBLIC_WEB_TABLE_CAPTURE',
            'generated_kst': now.isoformat(timespec='seconds'), 'captured_kst': now.isoformat(timespec='seconds'),
            'source_as_of_ct': None, 'source_as_of_kst': None,
            'source_as_of_ct_display': stamp[1] + ' CT', 'source_clock_convention': 'AMPM_NOT_SPECIFIED_IN_PUBLIC_LABEL',
            'market_data_as_of': asof.date().isoformat(), 'expected_market_data_date': expected,
            'freshness': state, 'freshness_reason': 'Verified daily official table; source timestamp preserved',
            'read_only': True, 'contains_account_data': False, 'current_target': target,
            'current_target_lower': lower, 'current_target_upper': upper, 'effr': None,
            'meeting_date': first['meeting_date'], 'meeting_count': len(rows), 'target_ranges': ranges,
            'meeting_probability_matrix': rows, 'outcomes': outcomes,
            'hold_probability': first['probability_same_as_current'],
            'hike_any_probability': first['probability_above_current'],
            'cut_any_probability': first['probability_below_current'],
            'hike_25bp_probability': first['probabilities'].get(f'{lower+.25:.2f}-{upper+.25:.2f}', 0),
            'cut_25bp_probability': first['probabilities'].get(f'{lower-.25:.2f}-{upper-.25:.2f}', 0),
            'change_1d_pctpt': first['change_1d_pp'].get(f'{lower+.25:.2f}-{upper+.25:.2f}'),
            'change_1w_pctpt': first['change_1w_pp'].get(f'{lower+.25:.2f}-{upper+.25:.2f}'),
            'history': [], 'path_summary': path,
            'quality': {'state': state, 'cme_trade_date_gap_business_days': 0 if state == 'LIVE' else None, 'matrix_meetings': len(rows), 'matrix_failures': [],
                        'published_precision_pctpt': .1, 'probability_sum_tolerance': ROUNDING_TOLERANCE},
            'calculation': {'matrix_method': 'Official published probabilities copied without renormalization; weighted summaries derived from rounded rows.'},
            'provenance': {'official_page': PAGE, 'evidence_sha256': digest}, 'official_evidence': evidence,
            'usage_contract': {'strategy_usable': state == 'LIVE', 'refresh_mode': 'ONCE_PER_SOURCE_DAY_STORED_JSON',
                               'attribution': 'CME FedWatch official public table · daily stored observation; not a real-time feed.'}}


def fetch_tables():
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def read(url, referer=PAGE, data=None):
        if urllib.parse.urlsplit(url).hostname not in {'www.cmegroup.com', 'cmegroup-tools.quikstrike.net'}:
            raise ValueError('OFFICIAL_SOURCE_HOST')
        req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0 JJOONI-Daily-FedWatch/1.0', 'Referer': referer})
        with opener.open(req, timeout=25) as response:
            return response.read().decode('utf-8'), response.url
    try:
        page, _ = read(PAGE)
        soup = BeautifulSoup(page, 'html.parser')
        frame = next((x.get('src') for x in soup.find_all('iframe') if 'cmegroup-tools.quikstrike.net' in str(x.get('src'))), None)
    except urllib.error.HTTPError as error:
        if error.code not in {403, 404, 500, 502, 503, 504}:
            raise
        # The CME marketing page and the publicly embedded QuikStrike data
        # service are separate hosts. Use the exact public embed observed on
        # the official page, with its normal parent Referer and fresh cookies.
        # Do not alter fingerprints, credentials, or retry a data-service denial.
        frame = HOST + '/User/QuikStrikeTools.aspx?viewitemid=IntegratedFedWatchTool&userId=lwolf&jobRole=&company=&companyType=&userId=&jobRole=&company=&companyType='
        print('FEDWATCH_OFFICIAL=PUBLIC_EMBED_DIRECT marketing_status=' + str(error.code))
    if not frame:
        raise ValueError('OFFICIAL_IFRAME_MISSING')
    loading, loading_url = read(frame)
    form = BeautifulSoup(loading, 'html.parser').find('form')
    if not form:
        raise ValueError('OFFICIAL_LOADING_FORM_MISSING')
    query = urllib.parse.urlsplit(form.get('action', '')).query
    current, current_url = read(HOST + '/User/QuikStrikeView.aspx?' + query)
    soup = BeautifulSoup(current, 'html.parser')
    link = next((a for a in soup.find_all('a') if a.get_text(strip=True) == 'Probabilities'), None)
    if not link:
        raise ValueError('OFFICIAL_MATRIX_LINK_MISSING')
    target = re.search(r"__doPostBack\('([^']+)'", link.get('href', ''))
    form = soup.find('form')
    if not target or not form:
        raise ValueError('OFFICIAL_MATRIX_FORM_MISSING')
    fields = {i['name']: i.get('value', '') for i in form.select('input[type=hidden][name]')}
    fields.update(__EVENTTARGET=target[1], __EVENTARGUMENT='')
    action = urllib.parse.urljoin(current_url, form['action'])
    matrix, _ = read(action, current_url, urllib.parse.urlencode(fields).encode())
    return current, matrix


def validate_saved(snapshot, now):
    stamp = datetime.strptime(snapshot['source_as_of_ct_display'], '%d %b %Y %H:%M:%S CT').date()
    evidence = snapshot['official_evidence']
    digest = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()
    if (snapshot.get('schema') != 'JJOONI_FED_WATCH_V1' or stamp > now.astimezone(CT).date() or
            stamp.isoformat() != snapshot.get('market_data_as_of') or
            digest != snapshot.get('provenance', {}).get('evidence_sha256')):
        raise ValueError('OFFICIAL_STORED_SOURCE_INTEGRITY')
    rows = snapshot.get('meeting_probability_matrix') or []
    if not rows or any(not 0 <= p <= 1 for r in rows for p in r['probabilities'].values()):
        raise ValueError('OFFICIAL_STORED_PROBABILITY_RANGE')
    if any(abs(sum(r['probabilities'].values()) - 1) > ROUNDING_TOLERANCE + 1e-9 for r in rows):
        raise ValueError('OFFICIAL_STORED_PROBABILITY_SUM')


def acquire(force=False, cache=CACHE, now=None):
    now = now or datetime.now(KST)
    expected = _expected_latest_trade_date(now.astimezone(ET)).isoformat()
    if cache.exists() and not force:
        saved = json.loads(cache.read_text())
        validate_saved(saved, now)
        if saved.get('source_kind') == SOURCE_KIND and saved.get('market_data_as_of', '') >= expected:
            print('FEDWATCH_OFFICIAL=USE_STORED_DAILY_SNAPSHOT source_date=' + saved['market_data_as_of'])
            return saved
    current, matrix = fetch_tables()
    snapshot = parse_tables(current, matrix, now)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print('FEDWATCH_OFFICIAL=CAPTURED source_date=' + snapshot['market_data_as_of'])
    return snapshot


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    acquire(force=args.force)
