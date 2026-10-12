from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import refresh_calendar_recent_forexfactory as recovery

KST = ZoneInfo('Asia/Seoul')


def sample_calendar():
    return {
        'events': [{
            'datetime_kst': '2026-10-01T22:45:00+09:00',
            'title': 'S&P Global US Manufacturing PMI',
            'country': 'US',
            'importance': 3,
            'actual_watch': True,
            'actual': None,
            'market_metrics': [{
                'key': 'sp_us_manufacturing_pmi',
                'label': 'S&P Global US Manufacturing PMI',
                'actual': None,
                'previous': '51.9',
            }],
        }],
        'actual_freshness': {'official_checks': []},
    }


def test_target_weeks_deduplicate_same_week():
    weeks = recovery.target_weeks(['2026-10-01', '2026-10-02', '2026-10-05'])
    assert [x.isoformat() for x in weeks] == ['2026-09-27', '2026-10-04']


def test_historical_row_maps_to_canonical_ff_shape():
    row = recovery.as_faireconomy_row({
        'currency': 'USD',
        'datetime_kst': '2026-10-01T22:45+09:00',
        'title': 'S&P Global US Manufacturing PMI',
        'actual': '52.0',
        'consensus': '51.8',
        'previous': '51.9',
    }, 'https://example.test/week')
    assert row == {
        'country': 'USD',
        'date': '2026-10-01T22:45+09:00',
        'title': 'S&P Global US Manufacturing PMI',
        'actual': '52.0',
        'forecast': '51.8',
        'previous': '51.9',
        '_source_url': 'https://example.test/week',
    }


def test_recovery_fills_missing_actual_without_network():
    calendar = sample_calendar()

    def fake_fetch(week):
        assert week.isoformat() == '2026-09-27'
        return 'https://example.test/week', [{
            'currency': 'USD',
            'datetime_kst': '2026-10-01T22:45+09:00',
            'date': '2026-10-01',
            'title': 'S&P Global US Manufacturing PMI',
            'actual': '52.0',
            'consensus': '51.8',
            'previous': '51.9',
        }]

    report = recovery.recover(
        calendar,
        now=datetime(2026, 10, 13, 9, 0, tzinfo=KST),
        fetcher=fake_fetch,
    )
    event = calendar['events'][0]
    metric = event['market_metrics'][0]
    assert report['overdue_before'] == 1
    assert report['overdue_after'] == 0
    assert report['field_updates'] >= 1
    assert event['actual'] == '52.0'
    assert metric['actual'] == '52.0'
    assert event['source_tier'] == 'MARKET_FEED'
    assert report['fetch_errors'] == []


def test_optional_source_classification_contract_present():
    src = (ROOT / 'tools/enrich_calendar_with_all_events.py').read_text(encoding='utf-8')
    assert 'OPTIONAL_NOT_CONFIGURED' in src
    assert 'OPTIONAL_ROLLOVER_ENDPOINT_UNAVAILABLE' in src
    assert 'PRIMARY_SOURCE_FAILURES_SEPARATE_FROM_OPTIONAL_OVERLAY_AVAILABILITY_V2' in src
