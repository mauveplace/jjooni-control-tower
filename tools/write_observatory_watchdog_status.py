#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'market-observatory' / 'data' / 'watchdog-status.json'
KST = ZoneInfo('Asia/Seoul')


def b(name: str) -> bool:
    return str(os.getenv(name, '')).strip().lower() == 'true'


def s(name: str):
    value = str(os.getenv(name, '')).strip()
    return value or None


def read(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def main():
    obs = read(ROOT / 'market-observatory' / 'data' / 'observatory.json')
    pulse = read(ROOT / 'market-observatory' / 'data' / 'daily-market-pulse.json')
    public = read(ROOT / 'public-market-daily.json')

    should_repair = b('SHOULD_REPAIR')
    eligible = b('ELIGIBLE')
    force_repair = b('FORCE_REPAIR')
    job_status = (s('JOB_STATUS') or 'unknown').lower()
    rebuild = (s('REBUILD_OUTCOME') or 'skipped').lower()
    acceptance = (s('ACCEPTANCE_OUTCOME') or 'skipped').lower()
    publish = (s('PUBLISH_OUTCOME') or 'skipped').lower()
    verify = (s('VERIFY_OUTCOME') or 'skipped').lower()

    if should_repair:
        if job_status == 'success' and publish == 'success' and verify == 'success':
            result = 'REPAIRED'
        elif job_status in {'failure', 'cancelled'} or rebuild == 'failure' or acceptance == 'failure' or publish == 'failure' or verify == 'failure':
            result = 'REPAIR_FAILED'
        else:
            result = 'REPAIR_INCOMPLETE'
    elif eligible and all(b(x) for x in ('OBS_FRESH', 'PULSE_FRESH', 'PUBLIC_FRESH', 'ALIGNED')):
        result = 'HEALTHY_NOOP'
    elif eligible:
        result = 'STALE_NO_REPAIR'
    else:
        result = 'OUTSIDE_RECOVERY_WINDOW'

    repository = s('GITHUB_REPOSITORY') or 'mauveplace/jjooni-control-tower'
    server = s('GITHUB_SERVER_URL') or 'https://github.com'
    run_id = s('GITHUB_RUN_ID')
    workflow_url = f'{server}/{repository}/actions/workflows/market-observatory-close-watchdog.yml'
    run_url = f'{server}/{repository}/actions/runs/{run_id}' if run_id else None

    payload = {
        'schema': 'JJOONI_OBSERVATORY_WATCHDOG_STATUS_V1',
        'checked_kst': datetime.now(KST).isoformat(timespec='seconds'),
        'checked_ny': s('NY_NOW'),
        'event': s('EVENT_NAME'),
        'eligible': eligible,
        'force_repair': force_repair,
        'decision': 'REPAIR' if should_repair else 'NOOP',
        'result': result,
        'before': {
            'observatory_fresh': b('OBS_FRESH'),
            'daily_market_pulse_fresh': b('PULSE_FRESH'),
            'public_market_daily_fresh': b('PUBLIC_FRESH'),
            'session_aligned': b('ALIGNED'),
        },
        'steps': {
            'rebuild': rebuild,
            'acceptance': acceptance,
            'publish': publish,
            'verify': verify,
        },
        'current': {
            'observatory_generated_kst': obs.get('generated_kst'),
            'observatory_session': obs.get('us_completed_session_date'),
            'pulse_generated_kst': pulse.get('generated_kst'),
            'pulse_session': pulse.get('market_date_us'),
            'public_generated_kst': public.get('generated_kst'),
            'tripod_session': (public.get('tripod_signal') or {}).get('date'),
        },
        'workflow_url': workflow_url,
        'run_url': run_url,
        'manual_dispatch_supported': True,
        'force_repair_supported': True,
        'repair_contract': 'CLOSE_WINDOW_SELF_HEAL_PLUS_MANUAL_FORCE_REPAIR_V1',
        'read_only_status': True,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('OBSERVATORY_WATCHDOG_STATUS=PASS', result, 'decision=', payload['decision'])


if __name__ == '__main__':
    main()
