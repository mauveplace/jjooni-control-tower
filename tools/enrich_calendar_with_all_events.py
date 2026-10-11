#!/usr/bin/env python3
"""Run curated calendar enrichment and the all-event fallback from one fetch.

`enrich_economic_calendar` owns the authoritative/curated mappings.  This
wrapper captures the TE/FairEconomy rows used by that pass and reuses the exact
same rows for generic long-tail matching, avoiding a second flaky network call.
"""
from __future__ import annotations

import json
from datetime import datetime

import enrich_economic_calendar as curated
from enrich_calendar_all_events import apply_all_event_enrichment


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
    curated.CAL.write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ECON_CAL_ALL_EVENT_WRAPPER=PASS te_rows=', len(captured['te']),
          'ff_rows=', len(captured['ff']), 'generic=', stats)


if __name__ == '__main__':
    main()
