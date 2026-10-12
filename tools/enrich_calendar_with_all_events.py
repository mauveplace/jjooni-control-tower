#!/usr/bin/env python3
"""Run curated calendar enrichment and the all-event fallback from one fetch.

`enrich_economic_calendar` owns the authoritative/curated mappings.  This
wrapper captures the TE/FairEconomy rows used by that pass and reuses the exact
same rows for generic long-tail matching, avoiding a second flaky network call.

Optional-source contract:
- Trading Economics is an optional overlay when no API key is configured.
- FairEconomy `lastweek`/`nextweek` convenience files are optional because the
  provider may expose only `thisweek`; recent historical recovery is handled by
  the browser-grade ForexFactory weekly collector.
- Failures of configured TE or the primary `thisweek` feed remain hard and
  keep collection_health DEGRADED.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

import enrich_economic_calendar as curated
from enrich_calendar_all_events import apply_all_event_enrichment


def classify_source_errors(errors):
    hard = []
    optional = []
    te_configured = bool((os.getenv('TRADING_ECONOMICS_API_KEY') or '').strip())
    for row in errors or []:
        source = str(row.get('source') or '')
        status = row.get('http_status')
        if source == 'Trading Economics' and not te_configured:
            optional.append({**row, 'reason': 'OPTIONAL_NOT_CONFIGURED'})
        elif source in {'FairEconomy/lastweek', 'FairEconomy/nextweek'} and status == 404:
            optional.append({**row, 'reason': 'OPTIONAL_ROLLOVER_ENDPOINT_UNAVAILABLE'})
        else:
            hard.append(row)
    return hard, optional


def main():
    captured = {'te': [], 'ff': []}
    original_te = curated.te_rows
    original_ff = curated.ff_rows

    def te_once():
        rows = original_te()
        captured['te'] = list(rows or [])
        return rows

    def ff_once():
        rows = original_ff()
        captured['ff'] = list(rows or [])
        return rows

    curated.te_rows = te_once
    curated.ff_rows = ff_once
    curated.main()

    calendar = json.loads(curated.CAL.read_text(encoding='utf-8'))
    stats = apply_all_event_enrichment(
        calendar,
        captured['te'],
        captured['ff'],
        datetime.now(curated.KST),
    )
    hard, optional = classify_source_errors(calendar.get('enrichment_errors') or [])
    checked = datetime.now(curated.KST).isoformat(timespec='seconds')
    calendar['collection_health'] = {
        'status': 'DEGRADED' if hard else 'LIVE',
        'checked_kst': checked,
        'failed_sources': hard,
        'optional_source_warnings': optional,
        'contract': 'PRIMARY_SOURCE_FAILURES_SEPARATE_FROM_OPTIONAL_OVERLAY_AVAILABILITY_V2',
    }
    calendar['source_health_contract'] = {
        'trading_economics': 'REQUIRED_WHEN_API_KEY_CONFIGURED_ELSE_OPTIONAL_OVERLAY',
        'faireconomy_thisweek': 'PRIMARY_MARKET_FEED',
        'faireconomy_lastweek_nextweek': 'OPTIONAL; HISTORICAL_WEEK_FETCHER_OWNS_ROLLOVER_RECOVERY',
    }
    curated.CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ECON_CAL_ALL_EVENT_WRAPPER=PASS te_rows=', len(captured['te']),
          'ff_rows=', len(captured['ff']), 'generic=', stats,
          'hard_source_failures=', len(hard), 'optional_warnings=', len(optional))


if __name__ == '__main__':
    main()
