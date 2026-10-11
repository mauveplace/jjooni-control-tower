#!/usr/bin/env python3
"""One ordered calendar pipeline shared by every publishing workflow.

Schedule seed -> restore observations -> collect official/secondary/feed once ->
merge curated forecasts + generic all-event fallback -> retain -> representative
sync -> compute health -> archive -> rolling 1Y history -> bounded historical
backfill -> previous-value fallback -> representative sync -> validate.

Event-level compact values must never be overwritten by auxiliary probability
metrics such as FedWatch after retention/history merges.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
CAL = ROOT / 'market-observatory/data/economic-calendar.json'


def run(script, *args):
    subprocess.run([sys.executable, str(ROOT / script), *map(str, args)], cwd=ROOT, check=True)


def normalize_calendar_contract():
    """Guarantee the published event schema after every retention merge."""
    data = json.loads(CAL.read_text(encoding='utf-8'))
    normalized = 0
    for event in data.get('events', []):
        for key in ['previous', 'consensus', 'actual', 'te_forecast', 'surprise', 'market_data_source']:
            if key not in event:
                event[key] = None
                normalized += 1
        if 'market_metrics' not in event or not isinstance(event.get('market_metrics'), list):
            event['market_metrics'] = []
            normalized += 1
    CAL.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'CALENDAR_CONTRACT_NORMALIZE=PASS fields={normalized}')


def refresh(previous=None, seed=False):
    with TemporaryDirectory(prefix='calendar-refresh-') as directory:
        snapshot = Path(directory) / 'before.json'
        snapshot.write_bytes(CAL.read_bytes())
        if seed:
            run('tools/calendar_market_events.py', 'seed')
        run('tools/persist_calendar_history.py', snapshot)
        if previous:
            run('tools/persist_calendar_history.py', previous)
        # One network fetch feeds both curated mappings and generic long-tail matching.
        run('tools/enrich_calendar_with_all_events.py')
        run('tools/calendar_market_events.py', 'refresh')
        run('tools/persist_calendar_history.py', snapshot)
        normalize_calendar_contract()
        # Retention can restore an old compact event-level value after the metric
        # rows were refreshed. Reassert the semantic representative before health
        # and archival so probability overlays can never become policy-card values.
        run('tools/sync_calendar_representative_values.py')
        run('tools/refresh_official_central_bank_actuals.py', '--health-only')
        run('tools/archive_calendar_actuals.py')
        # Build from captured canonical observations first, then backfill only the
        # portion of the 365-day window that predates our archive. Once covered,
        # the backfill script becomes a cheap no-op on later refreshes.
        run('tools/build_calendar_history.py')
        run('tools/backfill_calendar_history_forexfactory.py')
        run('tools/fill_calendar_previous_from_history.py')
        # History fallback may add a metric-level Previous; sync again so the compact
        # event card mirrors its primary non-probability metric before validation.
        run('tools/sync_calendar_representative_values.py')
        # Rebuild preserves the historical backfill while folding in any newly
        # derived Previous values and recalculating rolling-window metadata.
        run('tools/build_calendar_history.py')
        run('tests/test_calendar_data_quality.py')
    data = json.loads(CAL.read_text(encoding='utf-8'))
    health = data['actual_freshness']
    print(f'CALENDAR_PIPELINE=PASS health={health["status"]} '
          f'pending={health["pending_count"]} overdue={health["overdue_count"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous', type=Path)
    parser.add_argument('--seed', action='store_true')
    args = parser.parse_args()
    refresh(args.previous, args.seed)
