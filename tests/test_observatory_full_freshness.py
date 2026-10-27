from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_supplemental_refresh_contract_is_complete():
    src = (ROOT / 'tools/refresh_observatory_supplementals.py').read_text(encoding='utf-8')
    for token in [
        "'WTI':'CL=F'", "'BRENT':'BZ=F'", "'NATGAS':'NG=F'",
        "'GOLD':'GC=F'", "'SILVER':'SI=F'", "'COPPER':'HG=F'",
        "'DXY':'DX-Y.NYB'", "'USDKRW':'KRW=X'",
        "jgbcm.csv", "jgbcme.csv", "time(16,10)", "enrich_crypto(data)",
        "ALL_MARKET_FAMILIES_COMPLETED_SESSION_PLUS_24X7_CRYPTO_V1",
    ]:
        assert token in src, token


def test_jgb_current_parser_accepts_reiwa_and_japanese_tenors():
    mod = load_module('supplemental_jgb_test', 'tools/refresh_observatory_supplementals.py')
    blob = '基準日,1年,2年,3年,5年,10年,20年,30年,40年\nR8.10.9,1.2,1.95,2.0,2.1,2.9,3.7,4.1,4.2\n'.encode('utf-8')
    rows = mod._parse_jgb_csv(blob)
    assert rows[-1]['date'] == '2026-10-09'
    assert rows[-1]['values']['2Y'] == 1.95
    assert rows[-1]['values']['10Y'] == 2.9
    assert rows[-1]['values']['30Y'] == 4.1


class JgbMofPublicationContractTest(unittest.TestCase):
    def test_next_business_day_0930_jst_cutoff_and_weekend(self):
        mod = load_module('supplemental_jgb_publication_test', 'tools/refresh_observatory_supplementals.py')
        # MOF: reference-date yield is published around 09:30 on the next
        # business day. Do not treat the current Tokyo trading day as published.
        cases = [
            ('2026-10-27T19:05:00+09:00', '2026-10-26'),
            ('2026-10-27T09:29:00+09:00', '2026-10-23'),
            ('2026-10-27T09:30:00+09:00', '2026-10-26'),
            ('2026-10-26T09:29:00+09:00', '2026-10-22'),
            ('2026-10-26T09:30:00+09:00', '2026-10-23'),
            ('2026-10-25T20:00:00+09:00', '2026-10-22'),
            ('2026-10-31T12:00:00+09:00', '2026-10-29'),
        ]
        for stamp, expected in cases:
            with self.subTest(stamp=stamp):
                self.assertEqual(mod.expected_jgb_business_date(datetime.fromisoformat(stamp)), expected)


def test_audit_contract_recomputes_age_and_checks_fedwatch():
    src = (ROOT / 'tools/audit_observatory_data.py').read_text(encoding='utf-8')
    for token in [
        'JJOONI_OBSERVATORY_DATA_AUDIT_V2',
        'current_quote_age_seconds',
        'QUOTE_AGE_RECOMPUTED_AT_AUDIT_TIME_MAX_3600S',
        'FEDWATCH_DECLARATION_INCONSISTENT',
        'CME_FED_FUNDS_HOLIDAY_AWARE_EXPECTED_TRADE_DATE',
        "make_group('jp_rates'",
        "make_group('energy'",
        "make_group('fx'",
        "make_group('metals'",
        "groups['fedwatch']",
    ]:
        assert token in src, token


def test_calendar_audit_uses_canonical_overdue_and_collection_fields():
    audit = (ROOT / 'tools/audit_observatory_data.py').read_text(encoding='utf-8')
    fresh = (ROOT / 'tools/build_observatory_freshness.py').read_text(encoding='utf-8')
    for token in ["'overdue_count'", "'overdue_events'", "'pending_count'", "'pending_events'", "'collection_health'", "'failed_sources'"]:
        assert token in audit, token
    for token in ["'overdue_count'", "'overdue_events'", "'pending_count'", "'pending_events'", "'collection_health'", 'source_failures']:
        assert token in fresh, token
    assert "cal_fresh.get('overdue')" not in audit
    assert "cal_fresh.get('overdue')" not in fresh


def test_fedwatch_compat_does_not_reuse_stale_snapshot():
    mod = load_module('build_fed_watch_compat_test', 'tools/build_fed_watch.py')
    path = ROOT / 'tests' / '.tmp-fedwatch-stale.json'
    try:
        path.write_text(json.dumps({
            'market_data_as_of': '2020-01-02',
            'meeting_date': '2026-10-28',
            'probabilities': {'x': 1},
        }), encoding='utf-8')
        current, reason = mod._published_snapshot_is_current(path)
        assert current is False
        assert reason.startswith('STALE:')
    finally:
        path.unlink(missing_ok=True)


def test_fedwatch_expected_trade_date_skips_columbus_day():
    mod = load_module('build_fed_watch_holiday_test', 'tools/build_fed_watch.py')
    et = ZoneInfo('America/New_York')
    now = datetime(2026, 10, 12, 18, 0, tzinfo=et)
    assert mod._expected_latest_trade_date(now).isoformat() == '2026-10-09'
    next_day = datetime(2026, 10, 13, 18, 0, tzinfo=et)
    assert mod._expected_latest_trade_date(next_day).isoformat() == '2026-10-13'


def test_freshness_builder_exposes_every_family():
    src = (ROOT / 'tools/build_observatory_freshness.py').read_text(encoding='utf-8')
    assert 'JJOONI_OBSERVATORY_FRESHNESS_STATUS_V2' in src
    for key in [
        "'energy'", "'fx'", "'metals'", "'us_rates'", "'kr_rates'",
        "'jp_rates'", "'crypto'", "'official_macro'", "'audit'",
    ]:
        assert key in src, key


def test_full_grid_runtime_contains_all_market_families():
    src = (ROOT / 'market-observatory/freshness-all-groups-v1.js').read_text(encoding='utf-8')
    for key in ['energy','fx','metals','us_rates','kr_rates','jp_rates','crypto','official_macro','audit']:
        assert f"'{key}'" in src
    assert 'ALL_MARKET_FAMILY_FRESHNESS_GRID_V1' in src


def test_cross_market_workflow_runs_hourly_and_after_daily():
    src = (ROOT / '.github/workflows/market-observatory-supplemental-freshness.yml').read_text(encoding='utf-8')
    assert "cron: '25 * * * *'" in src
    assert 'Market Observatory Daily + Calendar' in src
    assert 'python tools/refresh_observatory_supplementals.py' in src
    assert 'python tools/audit_observatory_data.py' in src
    assert 'fedwatch-history' in src
