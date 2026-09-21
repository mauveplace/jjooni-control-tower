#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

KST=ZoneInfo('Asia/Seoul')
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from calendar_actual_contract import merge_observation, retain_calendar, PROVENANCE

ROOT=Path(__file__).resolve().parents[1]
CURRENT=ROOT/'market-observatory'/'data'/'economic-calendar.json'


def clean(v):
    if v is None:return None
    s=str(v).strip()
    return None if s in ('','None','null','nan','N/A','-','—') else s


def key(e):
    return (
        str(e.get('datetime_kst') or e.get('date') or '')[:10],
        str(e.get('country') or ''),
        str(e.get('title') or '').strip(),
    )


def metric_key(m):
    return str(m.get('key') or m.get('label') or '').strip()


def metric_fields(m):
    fields=['previous','consensus','actual','event_title','datetime_source','impact','source']
    if m.get('metric_type')=='market_probability_snapshot':
        fields.remove('actual')
    return fields


def main():
    if len(sys.argv)<2:
        print('CALENDAR_RETENTION=SKIP no previous snapshot')
        return
    prev_path=Path(sys.argv[1])
    if not prev_path.exists() or not CURRENT.exists():
        print('CALENDAR_RETENTION=SKIP snapshot missing')
        return

    cur=json.loads(CURRENT.read_text(encoding='utf-8'))
    prev=json.loads(prev_path.read_text(encoding='utf-8'))
    retain_calendar(cur, prev)
    kept_fields=kept_metrics=0
    cur['retention_contract']='PERSIST_RELEASED_VALUES_ACROSS_ROLLING_FEEDS_V1'
    cur['retention_note']='Previously captured previous/consensus/actual values are carried forward when short-horizon market feeds roll off; official observations take precedence over lower-tier updates.'
    cur['retention_preserved']={'event_fields':kept_fields,'metric_fields_or_rows':kept_metrics}
    cur['retention_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CURRENT.write_text(json.dumps(cur,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('CALENDAR_RETENTION=PASS event_fields=',kept_fields,'metric_fields_or_rows=',kept_metrics)

if __name__=='__main__':main()

