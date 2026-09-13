#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
OVR=ROOT/'market-observatory'/'data'/'calendar-manual-overrides.json'
KST=ZoneInfo('Asia/Seoul')


def clean(v):
    if v is None:return None
    s=str(v).strip()
    return None if s in ('','-','—','None','null','N/A') else s


def match_key(o):
    m=o.get('match') or {}
    return (m.get('date'),m.get('country'),m.get('title_contains'))


def main():
    cal=json.loads(CAL.read_text(encoding='utf-8'))
    out=json.loads(OVR.read_text(encoding='utf-8')) if OVR.exists() else {'schema':'JJOONI_CALENDAR_MANUAL_OVERRIDES_V1','overrides':[]}
    rows=out.setdefault('overrides',[])
    idx={match_key(o):i for i,o in enumerate(rows)}
    archived=0
    today=datetime.now(KST).date().isoformat()

    for e in cal.get('events') or []:
        day=str(e.get('datetime_kst') or e.get('date') or '')[:10]
        if not day or day>today:continue
        metrics=[]
        for m in e.get('market_metrics') or []:
            if not isinstance(m,dict) or clean(m.get('actual')) is None:continue
            metrics.append({k:m.get(k) for k in ['key','label','previous','consensus','actual','source'] if m.get(k) is not None})
        if not metrics and clean(e.get('actual')) is None:continue
        title=str(e.get('title') or '').strip()
        country=str(e.get('country') or '').strip()
        key=(day,country,title)
        payload={'match':{'date':day,'country':country,'title_contains':title},'source':str(e.get('market_data_source') or e.get('source') or 'captured market calendar')}
        if metrics:payload['market_metrics']=metrics
        for k in ['previous','consensus','actual']:
            if clean(e.get(k)) is not None:payload[k]=e.get(k)
        if key in idx:
            old=rows[idx[key]]
            # Existing curated seed wins unless an incoming field is newly available.
            if metrics:
                om={str(m.get('key') or m.get('label')):m for m in old.get('market_metrics') or []}
                for m in metrics:
                    mk=str(m.get('key') or m.get('label'))
                    base=dict(om.get(mk) or {})
                    for f,v in m.items():
                        if clean(v) is not None:base[f]=v
                    om[mk]=base
                old['market_metrics']=list(om.values())
            for f in ['previous','consensus','actual']:
                if clean(payload.get(f)) is not None:old[f]=payload[f]
            old['source']=payload['source']
        else:
            idx[key]=len(rows);rows.append(payload)
        archived+=1

    out['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    out['note']='Released previous/consensus/actual observations are archived so rolling weekly feeds cannot erase them. Official release schedules remain authoritative.'
    out['archive_contract']='PERSIST_RELEASED_VALUES_ACROSS_WEEKLY_FEED_ROLLOVER_V1'
    OVR.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('CALENDAR_ACTUAL_ARCHIVE=PASS events=',archived,'overrides=',len(rows))

if __name__=='__main__':main()
