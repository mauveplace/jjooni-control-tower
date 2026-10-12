from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import enrich_calendar_all_events as generic
import enrich_calendar_from_official_macro as bridge

KST = ZoneInfo('Asia/Seoul')


def macro_metric(actual, period, measure, series_id):
    return {
        'status': 'LIVE',
        'source_tier': 'OFFICIAL',
        'verification_status': 'OFFICIAL_SERIES_IDENTITY_VERIFIED',
        'series_identity': series_id,
        'checked_kst': '2026-10-13T06:52:50+09:00',
        'source_url': f'https://ecos.example/{series_id}',
        'primary_source': {'institution': 'KOSTAT'},
        'transport_source': {'provider': 'BOK ECOS official API', 'series_id': series_id, 'url': f'https://ecos.example/{series_id}'},
        'latest': {'period': period, 'value': actual},
        'release': {
            'actual': actual,
            'measure': measure,
            'reference_period': period,
            'source_tier': 'OFFICIAL',
            'source_url': f'https://ecos.example/{series_id}',
            'checked_kst': '2026-10-13T06:52:30+09:00',
        },
    }


def test_bridge_fills_exact_period_kr_cpi_and_industrial_actuals():
    calendar = {'events': [
        {'datetime_kst': '2026-10-02T08:00+09:00', 'title': '2026년 9월 소비자물가동향', 'country': 'KR', 'actual': None},
        {'datetime_kst': '2026-09-30T08:00+09:00', 'title': '2026년 8월 산업활동동향', 'country': 'KR', 'actual': None},
    ]}
    macro = {'generated_kst': '2026-10-13T06:52:50+09:00', 'metrics': {
        'KR_CPI': macro_metric(2.8789, '2026-09-01', 'YoY %', '901Y009/M/0'),
        'KR_INDUSTRIAL_PRODUCTION': macro_metric(-1.33, '2026-08-01', '% MoM SA', '901Y033/M/A00/2'),
    }}
    report = bridge.apply(calendar, macro, datetime(2026, 10, 13, 9, 0, tzinfo=KST))
    assert report['updated_events'] == 2
    assert calendar['events'][0]['actual'] == '2.8789%'
    assert calendar['events'][1]['actual'] == '-1.33%'
    for event in calendar['events']:
        assert event['source_tier'] == 'OFFICIAL'
        assert event['verification_status'] == 'VERIFIED_OFFICIAL'
        assert event['market_value_status'] == 'ACTUAL_AVAILABLE'
        assert event['official_actual_source'] == 'KOSTAT via BOK ECOS official API'


def test_bridge_rejects_reference_period_mismatch():
    calendar = {'events': [
        {'datetime_kst': '2026-10-02T08:00+09:00', 'title': '2026년 9월 소비자물가동향', 'country': 'KR', 'actual': None},
    ]}
    macro = {'metrics': {'KR_CPI': macro_metric(3.0915, '2026-08-01', 'YoY %', '901Y009/M/0')}}
    report = bridge.apply(calendar, macro, datetime(2026, 10, 13, 9, 0, tzinfo=KST))
    assert report['updated_events'] == 0
    assert calendar['events'][0].get('actual') is None
    assert report['checks'][0]['status'].startswith('REFERENCE_PERIOD_MISMATCH')


def test_official_bridge_cannot_downgrade_existing_official_actual():
    calendar = {'events': [
        {
            'datetime_kst': '2026-10-02T08:00+09:00',
            'title': '2026년 9월 소비자물가동향',
            'country': 'KR',
            'actual': '2.9%',
            'source_tier': 'OFFICIAL',
            'checked_kst': '2026-10-13T07:30:00+09:00',
            'value_vintage': 'AS_RELEASED',
        },
    ]}
    macro = {'metrics': {'KR_CPI': macro_metric(2.8789, '2026-09-01', 'YoY %', '901Y009/M/0')}}
    bridge.apply(calendar, macro, datetime(2026, 10, 13, 9, 0, tzinfo=KST))
    assert calendar['events'][0]['actual'] == '2.9%'


def test_bea_international_trade_title_matches_us_trade_balance_only():
    event = {
        'datetime_kst': '2026-10-06T21:30+09:00',
        'title': 'U.S. International Trade in Goods and Services, August 2026',
        'country': 'US',
    }
    ff = [
        {'country': 'USD', 'date': '2026-10-06T08:30:00-04:00', 'title': 'Trade Balance', 'actual': '-$58.1B', 'forecast': '-$59.0B', 'previous': '-$60.2B'},
        {'country': 'CAD', 'date': '2026-10-06T08:30:00-04:00', 'title': 'Trade Balance', 'actual': '-$2.0B'},
    ]
    rows = generic.normalized_rows([], ff)
    row, score = generic.best_row(event['title'], event, rows, threshold=60.0)
    assert row is not None
    assert row['country'] == 'US'
    assert row['title'] == 'Trade Balance'
    assert score >= 60.0
