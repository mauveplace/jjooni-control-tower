#!/usr/bin/env python3
"""Validate publication integrity while reporting each degraded collector."""
import json
import os
from pathlib import Path

from audit_observatory_data import build


def acceptance(audit, outcomes):
    if audit.get('schema') != 'JJOONI_OBSERVATORY_DATA_AUDIT_V2':
        raise RuntimeError('INVALID_AUDIT_SCHEMA')
    if int(audit.get('critical_count') or 0):
        raise RuntimeError('CRITICAL_PUBLICATION_INTEGRITY_FAILURE')
    degraded = {name: group.get('state') for name, group in
                (audit.get('groups') or {}).items() if group.get('state') != 'LIVE'}
    failed = {name: state for name, state in outcomes.items() if state != 'success'}
    return {'publication': 'PASS', 'source_health': 'DEGRADED' if degraded or failed else 'LIVE',
            'degraded_sources': degraded, 'collector_failures': failed,
            'warning_count': audit.get('warning_count', 0)}


def main():
    # Publishing rebases/merges source data. Recompute instead of reading an old
    # audit file restored by the publisher's cleanup of unselected artifacts.
    audit = build()
    outcomes = {name: os.environ.get(name + '_OUTCOME', 'unknown') for name in
                ('SUPPLEMENTAL', 'KR_RATES', 'FEDWATCH', 'SECTOR')}
    result = acceptance(audit, outcomes)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with Path(summary).open('a', encoding='utf-8') as handle:
            handle.write('## Independent source health\n```json\n' +
                         json.dumps(result, ensure_ascii=False, indent=2) + '\n```\n')
    for name, state in result['degraded_sources'].items():
        print(f'::warning title=Observatory source {name}::{state}; other sources published')
    for name, state in result['collector_failures'].items():
        print(f'::warning title=Observatory collector {name}::{state}; isolated from other sources')
    print('CROSS_MARKET_PUBLICATION_ACCEPTANCE=' + json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
