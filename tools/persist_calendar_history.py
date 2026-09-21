#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

KST=ZoneInfo('Asia/Seoul')
from calendar_actual_contract import retain_calendar, event_key, clean

ROOT=Path(__file__).resolve().parents[1]
CURRENT=ROOT/'market-observatory'/'data'/'economic-calendar.json'


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
    before={event_key(e):e for e in cur.get('events',[])}
    retain_calendar(cur, prev)
    kept_fields=kept_metrics=0
    for event in cur['events']:
        old=before.get(event_key(event),{})
        kept_fields+=sum(clean(event.get(k)) is not None and clean(old.get(k)) is None for k in ('actual','previous','consensus'))
        metrics={m.get('key'):m for m in old.get('market_metrics',[])}
        kept_metrics+=sum(clean(m.get(k)) is not None and clean(metrics.get(m.get('key'),{}).get(k)) is None for m in event.get('market_metrics',[]) for k in ('actual','previous','consensus'))
    cur['retention_contract']='PERSIST_RELEASED_VALUES_ACROSS_ROLLING_FEEDS_V1'
    cur['retention_note']='Previously captured previous/consensus/actual values are carried forward when short-horizon market feeds roll off; official observations take precedence over lower-tier updates.'
    cur['retention_preserved']={'event_fields':kept_fields,'metric_fields_or_rows':kept_metrics}
    cur['retention_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CURRENT.write_text(json.dumps(cur,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('CALENDAR_RETENTION=PASS event_fields=',kept_fields,'metric_fields_or_rows=',kept_metrics)

if __name__=='__main__':main()

