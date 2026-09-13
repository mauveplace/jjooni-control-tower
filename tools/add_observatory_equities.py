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

# Supplemental completed-session daily references used by the top numeric board.
# These stay separate from account/order data and are safe to refresh at the
# normal Observatory cadence.
SYMBOLS={
    'KOSPI':'^KS11',
    'KOSDAQ':'^KQ11',
    'RUSSELL2000':'^RUT',
    'DOW':'^DJI',
    'NASDAQCOMPOSITE':'^IXIC',
    'SILVER':'SI=F',
}

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
    src['GLOBAL_EQUITY_SUPPLEMENT']='Yahoo public daily (^RUT/^DJI/^IXIC)'
    src['SILVER']='Yahoo public daily (SI=F)'
    data['equity_enrichment_contract']='KOSPI_KOSDAQ_DAILY_REFERENCE_V1'
    data['market_supplement_contract']='GLOBAL_INDEX_AND_SILVER_DAILY_REFERENCE_V1'
    data['equity_enriched_kst']=datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('OBSERVATORY_MARKET_SUPPLEMENT=PASS',
          'KOSPI=',latest.get('KOSPI'),
          'KOSDAQ=',latest.get('KOSDAQ'),
          'RUT=',latest.get('RUSSELL2000'),
          'DOW=',latest.get('DOW'),
          'IXIC=',latest.get('NASDAQCOMPOSITE'),
          'SILVER=',latest.get('SILVER'))

if __name__=='__main__':main()
