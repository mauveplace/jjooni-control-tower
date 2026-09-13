#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

KST=ZoneInfo('Asia/Seoul')
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
    old={key(e):e for e in (prev.get('events') or [])}
    kept_fields=kept_metrics=0

    for e in cur.get('events') or []:
        p=old.get(key(e))
        if not p:continue
        for field in ['previous','consensus','actual','te_forecast','surprise','market_data_source']:
            if clean(e.get(field)) is None and clean(p.get(field)) is not None:
                e[field]=p.get(field);kept_fields+=1

        pm={metric_key(m):m for m in (p.get('market_metrics') or []) if metric_key(m)}
        cms=e.get('market_metrics') or []
        seen=set()
        for m in cms:
            mk=metric_key(m)
            if not mk:continue
            seen.add(mk);op=pm.get(mk)
            if not op:continue
            for field in ['previous','consensus','actual','event_title','datetime_source','impact','source']:
                if clean(m.get(field)) is None and clean(op.get(field)) is not None:
                    m[field]=op.get(field);kept_metrics+=1
        for mk,op in pm.items():
            if mk not in seen and any(clean(op.get(f)) is not None for f in ['previous','consensus','actual']):
                cms.append(dict(op));kept_metrics+=1
        e['market_metrics']=cms

    cur['retention_contract']='PERSIST_RELEASED_VALUES_ACROSS_ROLLING_FEEDS_V1'
    cur['retention_note']='Previously captured previous/consensus/actual values are carried forward when short-horizon market feeds roll off; newer non-null observations always win.'
    cur['retention_preserved']={'event_fields':kept_fields,'metric_fields_or_rows':kept_metrics}
    cur['retention_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CURRENT.write_text(json.dumps(cur,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('CALENDAR_RETENTION=PASS event_fields=',kept_fields,'metric_fields_or_rows=',kept_metrics)

if __name__=='__main__':main()
