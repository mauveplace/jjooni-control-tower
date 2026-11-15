#!/usr/bin/env python3
"""Fail loudly when the morning brief or the US-close data missed its deadline.

2026-11-12: the brief never published and nobody noticed until 08:46 KST.
The US-close cron was never delivered, and the brief is written outside this
repository, so no workflow failed and no e-mail was sent. This check runs after
the 06:25 KST publication target and turns a silent miss into a failed run.
"""
from __future__ import annotations
import json
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from observatory_session import expected_completed_session, trading_day  # noqa: E402

KST = ZoneInfo('Asia/Seoul')
DEADLINE = time(7, 0)
# Public US-session edition is Tue-Sat KST. Sunday has no new Friday/Saturday US close;
# Monday's separate edition is not a mandatory public Tue-Sat report.
PUBLICATION_WEEKDAYS = {1, 2, 3, 4, 5}


def decide(now, latest, observatory):
    now = now.astimezone(KST)
    problems = []
    expected = expected_completed_session(now)
    actual = observatory.get('us_completed_session_date')
    if actual != expected:
        problems.append(f'US_CLOSE_STALE expected={expected} actual={actual}')
    # A local KST report day corresponds to the preceding NYSE session date.
    # On full market holidays a new market brief is not required; early closes
    # are still trading sessions, so the normal publication check applies.
    us_day = now.date() - timedelta(days=1)
    if (now.weekday() in PUBLICATION_WEEKDAYS
            and trading_day(us_day) and now.time() >= DEADLINE):
        today = now.date().isoformat()
        if latest.get('report_date_kst') != today:
            problems.append(f"BRIEF_MISSING expected={today} latest={latest.get('report_date_kst')}")
    return problems


def main():
    root = Path(__file__).resolve().parents[1] / 'market-observatory' / 'data'
    latest = json.loads((root / 'morning-brief' / 'latest.json').read_text(encoding='utf-8'))
    observatory = json.loads((root / 'observatory.json').read_text(encoding='utf-8'))
    problems = decide(datetime.now(KST), latest, observatory)
    for p in problems:
        print('MORNING_PUBLICATION=FAIL', p)
    if not problems:
        print('MORNING_PUBLICATION=PASS')
    if any(p.startswith('US_CLOSE_STALE') for p in problems):
        Path('us-close-stale.flag').write_text('1')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
