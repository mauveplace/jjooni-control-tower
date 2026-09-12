#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, urllib.parse, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
KST=ZoneInfo('Asia/Seoul')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Calendar/2.0'

PREF={
 'Consumer Price Index':['inflation rate yoy','cpi yoy'],
 'Employment Situation':['non farm payrolls','nonfarm payrolls','unemployment rate'],
 'Producer Price Index':['producer prices change','ppi yoy'],
 'Job Openings and Labor Turnover':['jolts job openings','job openings'],
 'Employment Cost Index':['employment cost index'],
 'Productivity and Costs':['nonfarm productivity','unit labour costs','unit labor costs'],
 'Personal Income and Outlays':['core pce price index mom','pce price index yoy','personal spending'],
 'GDP':['gdp growth rate qoq','gdp growth rate'],
 'FOMC':['fed interest rate decision'],
 '통화정책방향':['interest rate decision'],
 '소비자물가':['inflation rate yoy','cpi'],
 '고용동향':['unemployment rate'],
 '산업활동':['industrial production yoy'],
 '생산자물가':['producer prices change','ppi yoy']
}

def norm(s):return re.sub(r'[^a-z0-9가-힣]+',' ',str(s or '').lower()).strip()
def req_json(url):
    r=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(r,timeout=25) as x:return json.load(x)

def te_rows():
    key=(os.getenv('TRADING_ECONOMICS_API_KEY') or '').strip()
    cred=key if key else 'guest:guest'
    now=datetime.now(KST).date();start=(now-timedelta(days=120)).isoformat();end=(now+timedelta(days=240)).isoformat()
    countries=urllib.parse.quote('united states,south korea',safe=',')
    url=f'https://api.tradingeconomics.com/calendar/country/{countries}/{start}/{end}?c={urllib.parse.quote(cred,safe=":")}'
    try:
        obj=req_json(url)
        return obj if isinstance(obj,list) else []
    except:return []

def score(event,row):
    ec='united states' if event.get('country')=='US' else 'south korea'
    rc=norm(row.get('Country'))
    if ec not in rc:return -999
    ed=str(event.get('datetime_kst') or '')[:10]
    rd=str(row.get('Date') or '')[:10]
    s=0
    if ed==rd:s+=20
    else:
        try:
            a=datetime.fromisoformat(ed);b=datetime.fromisoformat(rd);delta=abs((a.date()-b.date()).days)
            if delta<=1:s+=10
            elif delta<=2:s+=4
            else:return -999
        except:return -999
    title=norm(event.get('title')); rtxt=norm((row.get('Event') or '')+' '+(row.get('Category') or ''))
    prefs=[]
    for k,v in PREF.items():
        if norm(k) in title:prefs=v;break
    for i,p in enumerate(prefs):
        if norm(p) in rtxt:s+=15-i*2
    toks=[x for x in title.split() if len(x)>=4]
    s+=sum(1 for t in toks if t in rtxt)
    return s

def clean(v):
    if v is None:return None
    s=str(v).strip()
    return None if s in ('','None','null','nan','N/A') else s

def main():
    c=json.loads(CAL.read_text(encoding='utf-8'))
    rows=te_rows();matched=0
    for e in c.get('events') or []:
        e.setdefault('previous',None);e.setdefault('consensus',None);e.setdefault('actual',None);e.setdefault('te_forecast',None);e.setdefault('surprise',None);e.setdefault('market_data_source',None)
        best=None;bs=-999
        for r in rows:
            sc=score(e,r)
            if sc>bs:best,bs=r,sc
        if best is not None and bs>=20:
            e['previous']=clean(best.get('Previous'))
            e['consensus']=clean(best.get('Forecast'))
            e['actual']=clean(best.get('Actual'))
            e['te_forecast']=clean(best.get('TEForecast'))
            e['market_data_source']='Trading Economics'
            if e['actual'] is not None and e['consensus'] is not None:e['surprise']='actual_vs_consensus'
            matched+=1
    c['enrichment_contract']='OFFICIAL_SCHEDULE_PLUS_MARKET_CONSENSUS_ACTUAL'
    c['enrichment_note']='Consensus/actual are populated only when a market-data source returns a matched observation; missing values remain null.'
    c['enrichment_source']='Trading Economics API' if rows else 'UNAVAILABLE_OR_GUEST_LIMITED'
    c['enrichment_matched']=matched
    c['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CAL.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ECON_CAL_ENRICH=PASS source_rows=',len(rows),'matched=',matched)
if __name__=='__main__':main()
