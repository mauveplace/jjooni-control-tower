#!/usr/bin/env python3
"""Validate the published morning brief and its dated archive without market estimation."""
from __future__ import annotations
import argparse
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def validate_report(d):
    assert d.get('schema') == 'JJOONI_MORNING_BRIEF_V1', 'BRIEF_SCHEMA'
    assert d.get('read_only') is True and d.get('contains_account_data') is False, 'BRIEF_PUBLIC_BOUNDARY'
    report_day = date.fromisoformat(d['report_date_kst'])
    assert date.fromisoformat(d['market_date_us']) <= report_day, 'MARKET_DATE_AFTER_REPORT'
    created = datetime.fromisoformat(d['generated_kst'])
    published = datetime.fromisoformat(d['published_kst'])
    assert created.utcoffset() == published.utcoffset() == timedelta(hours=9), 'KST_OFFSET'
    assert created.date() == report_day and published >= created, 'REPORT_TIMESTAMPS'
    assert d.get('content_status') in {'USER_PROVIDED_NOT_REVERIFIED', 'WEB_VERIFIED_WITH_DISCLOSED_GAPS'}, 'CONTENT_STATUS'
    assert isinstance(d.get('verification_note'), str) and d['verification_note'].strip(), 'VERIFICATION_NOTE'
    body = d.get('body_markdown')
    assert isinstance(body, str) and 500 <= len(body) <= 200_000, 'BODY_LENGTH'
    sections = re.findall(r'^##\s+([①②③④⑤⑥⑦⑧])', body, re.M)
    assert sections == list('①②③④⑤⑥⑦⑧'), ('EIGHT_SECTIONS', sections)
    assert re.search(r'\[[^\]\n]+\]\(https?://[^\s)]+\)', body), 'SOURCE_LINKS'
    assert '' not in body, 'CHAT_ONLY_CITATION_TOKEN'
    return d

def validate_directory(directory):
    latest = validate_report(read(directory / 'latest.json'))
    index = read(directory / 'index.json')
    assert index.get('schema') == 'JJOONI_MORNING_BRIEF_INDEX_V1', 'INDEX_SCHEMA'
    entries = index.get('entries')
    assert isinstance(entries, list) and entries, 'EMPTY_INDEX'
    days = [e['report_date_kst'] for e in entries]
    assert days == sorted(set(days), reverse=True), 'INDEX_ORDER_OR_DUPLICATE'
    assert latest['report_date_kst'] == days[0], 'LATEST_NOT_MOST_RECENT'
    for entry in entries:
        day = date.fromisoformat(entry['report_date_kst'])
        path = day.strftime('%Y%m%d') + '.json'
        assert entry.get('path') == path, 'ARCHIVE_PATH'
        archived = validate_report(read(directory / path))
        for key in ('report_date_kst', 'market_date_us', 'title', 'generated_kst', 'published_kst'):
            assert archived.get(key) == entry.get(key), ('INDEX_ARCHIVE_MISMATCH', key)
        if entry['report_date_kst'] == latest['report_date_kst']:
            assert archived == latest, 'LATEST_ARCHIVE_MISMATCH'
    print('MORNING_BRIEF_ACCEPTANCE=PASS', 'latest='+latest['report_date_kst'], 'archives='+str(len(entries)))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'market-observatory' / 'data' / 'morning-brief')
    validate_directory(parser.parse_args().directory)
