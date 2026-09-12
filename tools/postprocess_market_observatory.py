#!/usr/bin/env python3
from __future__ import annotations
import json, os, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OBS=ROOT/'market-observatory'/'data'/'observatory.json'
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
KST=ZoneInfo('Asia/Seoul'); ET=ZoneInfo('America/New_York')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Post/1.0'
KR={'KR3Y':'010200000','KR5Y':'010200001','KR10Y':'010210000','KR20Y':'010220000','KR30Y':'010230000'}

def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)

def ecos_page(item,start,end,pos,last,key):
    url=f'https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/{pos}/{last}/817Y002/D/{start}/{end}/{item}'
    return get_json(url).get('StatisticSearch') or {}

def ecos_series(item,start,end,key='sample',cap=400):
    size=10 if key=='sample' else 1000; pos=1;rows=[];total=None
    while pos<=cap:
        block=ecos_page(item,start,end,pos,pos+size-1,key)
        batch=block.get('row') or []
        if total is None:
            try:total=int(block.get('list_total_count') or 0)
            except:total=0
        rows.extend(batch)
        if not batch or pos+size>total:break
        pos+=size
    out=[]
    for r in rows:
        try:v=float(r.get('DATA_VALUE'))
        except:continue
        t=str(r.get('TIME') or '')
        if len(t)==8:t=f'{t[:4]}-{t[4:6]}-{t[6:8]}'
        if len(t)==10:out.append({'date':t,'value':v})
    ded={x['date']:x for x in out};return [ded[k] for k in sorted(ded)]

def merge(a,b):
    d={x['date']:x for x in (a or [])};d.update({x['date']:x for x in (b or [])});return [d[k] for k in sorted(d)]

def patch_rates(o):
    key=os.getenv('BOK_ECOS_API_KEY') or 'sample'; now=datetime.now(KST)
    s=o.setdefault('series',{}); latest=o.setdefault('latest',{})
    first=not bool(s.get('KR3Y'))
    start=(now-timedelta(days=370 if first else 45)).strftime('%Y%m%d');end=now.strftime('%Y%m%d')
    errors={}
    for name,item in KR.items():
        try:
            fresh=ecos_series(item,start,end,key,cap=320 if first else 80)
            if fresh:s[name]=merge(s.get(name),fresh)
            latest[name]=s[name][-1]['value'] if s.get(name) else None
        except Exception as exc:errors[name]=type(exc).__name__
    if s.get('KR3Y') and s.get('KR10Y'):
        a={x['date']:x['value'] for x in s['KR10Y']};b={x['date']:x['value'] for x in s['KR3Y']};s['KR_3S10S']=[{'date':d,'value':round(a[d]-b[d],8)} for d in sorted(set(a)&set(b))];latest['KR_3S10S']=s['KR_3S10S'][-1]['value'] if s['KR_3S10S'] else None
    us=latest.get('US10Y_OFFICIAL') or latest.get('US10Y')
    if latest.get('KR10Y') is not None and us is not None:latest['KR_US_10Y']=round(latest['KR10Y']-us,8)
    o.setdefault('quality',{})['kr_rates']={'state':'PASS' if latest.get('KR10Y') is not None else 'UNAVAILABLE','source':'BOK_ECOS','window':'1Y_BACKFILL_THEN_45D_INCREMENT','errors':errors}

def patch_calendar(c):
    events=c.get('events') or []
    # Correct FOMC statement timestamps: 2 p.m. ET on second meeting day -> KST with DST.
    fomc=['2026-01-28','2026-03-18','2026-04-29','2026-06-17','2026-07-29','2026-09-16','2026-10-28','2026-12-09']
    bydate={d:datetime.strptime(d+' 14:00','%Y-%m-%d %H:%M').replace(tzinfo=ET).astimezone(KST).isoformat(timespec='minutes') for d in fomc}
    for e in events:
        if e.get('source')=='Federal Reserve' and 'FOMC' in e.get('title',''):
            raw=str(e.get('datetime_kst') or '')[:10]
            if raw in bydate:e['datetime_kst']=bydate[raw]
    # Keep calendar compact: current year through end of next year.
    y=datetime.now(KST).year; lo=f'{y}-01-01';hi=f'{y+1}-12-31'
    events=[e for e in events if lo<=str(e.get('datetime_kst') or '')[:10]<=hi]
    events.sort(key=lambda e:e.get('datetime_kst') or '')
    c['events']=events;c['generated_kst']=datetime.now(KST).isoformat(timespec='seconds');c['time_contract']='ALL_TIMES_KST';c['importance_contract']='3=market_moving,2=major,1=reference'

def main():
    o=json.loads(OBS.read_text(encoding='utf-8'));c=json.loads(CAL.read_text(encoding='utf-8'))
    patch_rates(o);patch_calendar(c)
    o['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');CAL.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('MARKET_OBSERVATORY_POSTPROCESS=PASS')
    print('KR10Y=',o.get('latest',{}).get('KR10Y'),'KR3S10S=',o.get('latest',{}).get('KR_3S10S'),'calendar=',len(c.get('events') or []))
if __name__=='__main__':main()
