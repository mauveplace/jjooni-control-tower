#!/usr/bin/env python3
"""Publish generated files without blindly overwriting concurrent observations.

Calendar conflicts use the same source-ranked merge as collection. Conflicts in
code/UI files stop publication; they are never resolved with `-X theirs`.
"""
import argparse
import json
import subprocess
from copy import deepcopy
from datetime import datetime
from pathlib import Path

from calendar_actual_contract import KST, build_freshness, merge_observation, retain_calendar

ROOT = Path(__file__).resolve().parents[1]
DATA = 'market-observatory/data/'


def git(*args, check=True):
    return subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, check=check)


def merge_generated(path, local, remote):
    if path.endswith('/economic-calendar.json'):
        result = retain_calendar(deepcopy(local), remote)
        checks = result.get('actual_freshness', {}).get('official_checks', [])
        result['actual_freshness'] = build_freshness(result, datetime.now(KST), checks)
        return result
    if path.endswith('/calendar-manual-overrides.json'):
        result = deepcopy(local)
        def key(row):
            match = row.get('match', {})
            return match.get('date'), match.get('country'), match.get('title_contains')
        rows = {key(row): row for row in remote.get('overrides', [])}
        for row in local.get('overrides', []):
            old = rows.get(key(row), {})
            merged = merge_observation(old, row)
            if old.get('event') or row.get('event'):
                merged['event'] = merge_observation(old.get('event', {}), row.get('event', {}))
            rows[key(row)] = merged
        result['overrides'] = list(rows.values())
        return result
    if path.endswith('/calendar-official-release-cache.json'):
        return {**local, 'documents': {**remote.get('documents', {}), **local.get('documents', {})}}
    # Other generated JSON snapshots use the newer complete generation.
    if str(remote.get('generated_kst', '')) > str(local.get('generated_kst', '')):
        return remote
    return local


def publish(paths, message):
    for path in paths:
        if not (ROOT / path).is_file():
            raise ValueError(f'Publish path missing: {path}')
    git('add', '--', *paths)
    if git('diff', '--cached', '--quiet', check=False).returncode == 0:
        print('OBSERVATORY_PUBLISH=NO_CHANGE')
        return
    git('commit', '-m', message)
    for attempt in range(3):
        git('fetch', 'origin', 'main')
        payloads = {}
        for path in paths:
            if not path.startswith(DATA) or not path.endswith('.json'):
                continue
            remote = git('show', 'origin/main:' + path, check=False)
            local = json.loads((ROOT / path).read_text(encoding='utf-8'))
            merged = merge_generated(path, local, json.loads(remote.stdout)) if remote.returncode == 0 else local
            payloads[path] = json.dumps(merged, ensure_ascii=False, indent=2) + '\n'
        # Resolve only generated JSON conflicts, with previously merged payloads.
        result = git('rebase', 'origin/main', check=False)
        while result.returncode:
            conflicts = git('diff', '--name-only', '--diff-filter=U').stdout.splitlines()
            if not conflicts or any(path not in payloads for path in conflicts):
                git('rebase', '--abort', check=False)
                raise RuntimeError('Concurrent non-data change requires review: ' + ', '.join(conflicts))
            for path in conflicts:
                (ROOT / path).write_text(payloads[path], encoding='utf-8')
            git('add', '--', *conflicts)
            result = git('-c', 'core.editor=true', 'rebase', '--continue', check=False)
        for path, payload in payloads.items():
            (ROOT / path).write_text(payload, encoding='utf-8')
        git('add', '--', *payloads)
        if git('diff', '--cached', '--quiet', check=False).returncode:
            git('commit', '-m', 'data(observatory): preserve concurrent official observations')
        if git('push', 'origin', 'HEAD:main', check=False).returncode == 0:
            print('OBSERVATORY_PUBLISH=PASS commit=' + git('rev-parse', 'HEAD').stdout.strip())
            return
        print(f'OBSERVATORY_PUBLISH_RETRY={attempt+1}')
    raise RuntimeError('Publication failed after three concurrent-update retries')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--message', required=True)
    parser.add_argument('paths', nargs='+')
    args = parser.parse_args()
    publish(args.paths, args.message)
