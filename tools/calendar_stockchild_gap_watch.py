#!/usr/bin/env python3
"""Optional stockchild.com weekly schedule gap review.

This secondary blog is never a source of official actuals or confirmed times.
Only date-explicit event candidates absent from the canonical calendar are
listed for review. Network failures, missing posts and empty results are normal
and MUST NOT fail the official calendar pipeline.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory/data/economic-calendar.json'
KST = ZoneInfo('Asia/Seoul')
SITE = 'https://stockchild.com'
PINNED = SITE + '/10%ec%9b%94-5%ec%a3%bc-%ec%a6%9d%ec%8b%9c%ec%9d%bc%ec%a0%95-%ec%ba%98%eb%a6%b0%eb%8d%94-%eb%b9%85%ed%85%8c%ed%81%ac/'
MAX_POSTS = 3
INTERVAL_HOURS = 24
DATE_TOKEN = re.compile(r'(?:(20\\d{2})\\s*[년./-]\\s*)?(\\d{1,2})\\s*[월./-]\\s*(\\d{1,2})\\s*일?(?!\\d)')
CALENDAR_WORDS = re.compile(r'증시\\s*일정|경제\\s*일정|주간\\s*일정|캘린더|빅테크|실적\\s*발표', re.I)
EVENT_WORDS = re.compile(r'실적|발표|FOMC|금리|GDP|CPI|PCE|고용|연준|회의|주주|배당|컨퍼런스|엔비디아|애플|마이크로소프트|메타|아마존|구글|테슬라|삼성|하이닉스|빅테크', re.I)


def read_html(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('stockchild.com', 'www.stockchild.com'):
        raise ValueError('non-allowlisted source')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 JJOONI-Calendar-Gap-Review/1.0'})
    with urllib.request.urlopen(req, timeout=5) as response:
        body = response.read(1_500_001)
    if len(body) > 1_500_000:
        raise ValueError('optional source size limit')
    return body.decode('utf-8-sig', 'replace')


def recent_posts(feed_xml: str, now: datetime) -> list[str]:
    out = []
    try:
        root = ET.fromstring(feed_xml)
        for item in root.findall('.//item'):
            title = item.findtext('title') or ''
            if not CALENDAR_WORDS.search(title):
                continue
            link = item.findtext('link') or ''
            u = urlparse(link)
            if u.scheme == 'https' and u.hostname in ('stockchild.com', 'www.stockchild.com'):
                out.append(link)
    except ET.ParseError:
        return []
    return list(dict.fromkeys(out))[:MAX_POSTS]


def extract_candidates(html: str, source_url: str, today: date) -> list[dict]:
    soup = BeautifulSoup(html, 'html.parser')
    for el in soup.select('script,style,nav,footer,aside,form'):
        el.decompose()
    root = soup.select_one('article') or soup.select_one('main') or soup
    out = []
    # Explicit date and event must share the same paragraph, bullet, or row.
    # Week-heading dates and inferred time zones are not sufficient.
    for el in root.select('li,p,tr'):
        raw = el.get_text(' ', strip=True)
        raw = re.sub(r'\\s+', ' ', raw)
        if not (10 <= len(raw) <= 270 and EVENT_WORDS.search(raw)):
            continue
        match = DATE_TOKEN.search(raw)
        if not match:
            continue
        year = int(match[1]) if match[1] else today.year
        try:
            d = date(year, int(match[2]), int(match[3]))
        except ValueError:
            continue
        if not (today <= d <= today + timedelta(days=21)):
            continue
        title = re.sub(r'^[\\s:·|/—-]+|[\\s:·|/—-]+$', '', (raw[:match.start()] + ' ' + raw[match.end():]).strip())
        title = re.sub(r'^[(（]?[월화수목금토일][)）]?\\s*', '', title).strip()
        if len(title) < 4 or len(title) > 150 or not EVENT_WORDS.search(title):
            continue
        out.append({'date': d.isoformat(), 'title': title, 'source_url': source_url,
                    'source': 'Stockchild (보조 일정 점검)',
                    'verification': 'UNVERIFIED_SECONDARY_CANDIDATE',
                    'time_status': 'UNCONFIRMED'})
    unique = {(e['date'], e['title']): e for e in out}
    return list(unique.values())


def missing_candidates(candidates: list[dict], calendar: dict) -> list[dict]:
    existing = [(str(e.get('datetime_kst') or e.get('date') or '')[:10],
                 str(e.get('title') or '')) for e in calendar.get('events', [])]
    def norm(s: str) -> str:
        return re.sub(r'[^0-9a-z가-힣]', '', s.lower().replace('earnings', '실적'))
    out = []
    for row in candidates:
        term = norm(row['title'])
        if any(row['date'] == d and (term == norm(title) or
               (len(term) >= 8 and len(norm(title)) >= 8 and
                SequenceMatcher(None, term, norm(title)).ratio() >= 0.72))
               for d, title in existing):
            continue
        out.append(row)
    return sorted(out, key=lambda x: (x['date'], x['title']))[:30]


def review(calendar: dict, now: datetime, fetcher=read_html) -> dict:
    previous = calendar.get('stockchild_gap_review') or {}
    checked = previous.get('checked_kst')
    try:
        if checked and (now - datetime.fromisoformat(checked)).total_seconds() < INTERVAL_HOURS * 3600:
            return previous
    except (ValueError, TypeError):
        pass
    urls = []
    try:
        urls.extend(recent_posts(fetcher(SITE + '/feed/'), now))
    except Exception:
        pass  # This is an optional supplementary resource, not an outage.
    urls.append(PINNED)
    candidates = []
    reachable = 0
    for url in list(dict.fromkeys(urls))[:MAX_POSTS + 1]:
        try:
            html = fetcher(url)
            reachable += 1
            candidates.extend(extract_candidates(html, url, now.date()))
        except Exception:
            continue
    result = {
        'schema': 'JJOONI_CALENDAR_STOCKCHILD_GAP_REVIEW_V1',
        'checked_kst': now.isoformat(timespec='seconds'),
        'source': SITE,
        'contract': 'OPTIONAL_MISSING_SCHEDULE_CANDIDATES_ONLY_NEVER_OFFICIAL',
        'state': 'SCANNED' if reachable else 'OPTIONAL_UNAVAILABLE',
        'candidate_events': missing_candidates(candidates, calendar),
    }
    calendar['stockchild_gap_review'] = result
    return result


def main():
    doc = json.loads(CAL.read_text(encoding='utf-8'))
    result = review(doc, datetime.now(KST))
    CAL.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\\n', encoding='utf-8')
    print('OPTIONAL_CALENDAR_GAP_REVIEW=PASS candidates=' + str(len(result.get('candidate_events', []))))


if __name__ == '__main__':
    main()
