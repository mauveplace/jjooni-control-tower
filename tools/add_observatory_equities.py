#!/usr/bin/env python3
from __future__ import annotations
import json, math, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OBS=ROOT/'market-observatory'/'data'/'observatory.json'
KST=ZoneInfo('Asia/Seoul');ET=ZoneInfo('America/New_York')
YAHOO='https://query1.finance.yahoo.com/v8/finance/chart/'
UA='Mozilla/5.0 JJOONI-Market-Observatory/1.0'
SYMBOLS={'KOSPI':'^KS11','KOSDAQ':'^KQ11'}

def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.loads(r.read().decode('utf-8'))

def series(symbol):
    qs=urllib.parse.urlencode({'interval':'1d','range':'3y','includePrePost':'false','events':'div,splits'})
    obj=get_json(YAHOO+urllib.parse.quote(symbol,safe='')+'?'+qs)
    rs=((obj.get('chart') or {}).get('result') or [])
    if not rs:return []
    b=rs[0];ts=b.get('timestamp') or [];cs=((((b.get('indicators') or {}).get('quote') or [{}])[0]).get('close') or [])
    out=[]
    for t,v in zip(ts,cs):
        if v is None:continue
        try:v=float(v)
        except:continue
        if not math.isfinite(v):continue
        d=datetime.fromtimestamp(int(t),ET).date().isoformat()
        out.append({'date':d,'value':round(v,8)})
    ded={x['date']:x for x in out}
    return [ded[k] for k in sorted(ded)]

def main():
    data=json.loads(OBS.read_text(encoding='utf-8'))
    sm=data.setdefault('series',{});latest=data.setdefault('latest',{});src=data.setdefault('sources',{})
    prev=dict(sm)
    for key,sym in SYMBOLS.items():
        try:xs=series(sym)
        except Exception as e:
            print(f'{key}_FETCH_WARN={e}');xs=prev.get(key,[])
        sm[key]=xs
        latest[key]=xs[-1]['value'] if xs else None
    src['KR_EQUITY']='Yahoo public daily (^KS11/^KQ11)'
    data['equity_enrichment_contract']='KOSPI_KOSDAQ_DAILY_REFERENCE_V1'
    data['equity_enriched_kst']=datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('OBSERVATORY_KR_EQUITIES=PASS KOSPI=',latest.get('KOSPI'),'KOSDAQ=',latest.get('KOSDAQ'))

if __name__=='__main__':main()
