#!/usr/bin/env python3
"""One ordered calendar pipeline shared by every publishing workflow.

Schedule seed -> restore observations -> collect official/secondary/feed ->
merge curated forecasts -> retain -> compute health -> archive -> validate.
Health must describe the final merged payload, never an intermediate build.
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


def refresh(previous=None, seed=False):
    with TemporaryDirectory(prefix='calendar-refresh-') as directory:
        snapshot = Path(directory) / 'before.json'
        snapshot.write_bytes(CAL.read_bytes())
        if seed:
            run('tools/calendar_market_events.py', 'seed')
        # Restore before collecting, so rebuilding schedules cannot hide backlog
        # or repeatedly fetch values already confirmed by an official source.
        run('tools/persist_calendar_history.py', snapshot)
        if previous:
            run('tools/persist_calendar_history.py', previous)
        run('tools/enrich_economic_calendar.py')
        run('tools/calendar_market_events.py', 'refresh')
        run('tools/persist_calendar_history.py', snapshot)
        run('tools/refresh_official_central_bank_actuals.py', '--health-only')
        run('tools/archive_calendar_actuals.py')
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
