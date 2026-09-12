#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, urllib.parse, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
KST=ZoneInfo('Asia/Seoul')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Calendar/2.1'

PREF={
 'Consumer Price Index':['cpi y/y','inflation rate yoy','cpi yoy'],
 'Employment Situation':['non-farm employment change','non farm payrolls','unemployment rate'],
 'Producer Price Index':['ppi m/m','producer prices change','ppi yoy'],
 'Job Openings and Labor Turnover':['jolts job openings','job openings'],
 'Employment Cost Index':['employment cost index'],
 'Productivity and Costs':['nonfarm productivity','unit labour costs','unit labor costs'],
 'Personal Income and Outlays':['core pce price index m/m','core pce price index mom','pce price index yoy','personal spending'],
 'GDP':['gdp growth rate qoq','gdp growth rate'],
 'FOMC':['federal funds rate','fed interest rate decision'],
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
    key=(os.getenv('TRADING_ECONOMICS_API_KEY') or '').strip();cred=key if key else 'guest:guest'
    now=datetime.now(KST).date();start=(now-timedelta(days=120)).isoformat();end=(now+timedelta(days=240)).isoformat();countries=urllib.parse.quote('united states,south korea',safe=',')
    url=f'https://api.tradingeconomics.com/calendar/country/{countries}/{start}/{end}?c={urllib.parse.quote(cred,safe=":")}'
    try:
        obj=req_json(url);return obj if isinstance(obj,list) else []
    except:return []

def ff_rows():
    out=[]
    for name in ['thisweek','nextweek']:
        try:
            xs=req_json(f'https://nfs.faireconomy.media/ff_calendar_{name}.json')
            if isinstance(xs,list):out.extend(xs)
        except:pass
    return out

def prefs_for(title):
    t=norm(title)
    for k,v in PREF.items():
        if norm(k) in t:return v
    return []

def event_date(e):return str(e.get('datetime_kst') or '')[:10]
def clean(v):
    if v is None:return None
    s=str(v).strip();return None if s in ('','None','null','nan','N/A') else s

def score_te(event,row):
    ec='united states' if event.get('country')=='US' else 'south korea';rc=norm(row.get('Country'))
    if ec not in rc:return -999
    ed=event_date(event);rd=str(row.get('Date') or '')[:10];s=0
    try:delta=abs((datetime.fromisoformat(ed).date()-datetime.fromisoformat(rd).date()).days)
    except:return -999
    if delta==0:s+=20
    elif delta<=1:s+=10
    else:return -999
    rtxt=norm((row.get('Event') or '')+' '+(row.get('Category') or ''))
    for i,p in enumerate(prefs_for(event.get('title'))):
        if norm(p) in rtxt:s+=18-i*3
    return s

def score_ff(event,row):
    if event.get('country')!='US' or str(row.get('country') or '').upper()!='USD':return -999
    try:rd=datetime.fromisoformat(str(row.get('date'))).astimezone(KST).date().isoformat()
    except:return -999
    ed=event_date(event)
    try:delta=abs((datetime.fromisoformat(ed).date()-datetime.fromisoformat(rd).date()).days)
    except:return -999
    if delta>1:return -999
    s=20 if delta==0 else 10;rtxt=norm(row.get('title'))
    for i,p in enumerate(prefs_for(event.get('title'))):
        if norm(p) in rtxt:s+=20-i*3
    return s

def best_match(event,rows,scorer,threshold=20):
    best=None;bs=-999
    for r in rows:
        sc=scorer(event,r)
        if sc>bs:best,bs=r,sc
    return best if best is not None and bs>=threshold else None

def main():
    c=json.loads(CAL.read_text(encoding='utf-8'));te=te_rows();ff=ff_rows();matched_te=matched_ff=0
    for e in c.get('events') or []:
        e['previous']=None;e['consensus']=None;e['actual']=None;e['te_forecast']=None;e['surprise']=None;e['market_data_source']=None
        r=best_match(e,te,score_te)
        if r:
            e['previous']=clean(r.get('Previous'));e['consensus']=clean(r.get('Forecast'));e['actual']=clean(r.get('Actual'));e['te_forecast']=clean(r.get('TEForecast'));e['market_data_source']='Trading Economics';matched_te+=1
        # Public ForexFactory/FairEconomy feed is used as a forecast/previous fallback for near-term U.S. events.
        f=best_match(e,ff,score_ff)
        if f:
            if e['previous'] is None:e['previous']=clean(f.get('previous'))
            if e['consensus'] is None:e['consensus']=clean(f.get('forecast'))
            if e['actual'] is None:e['actual']=clean(f.get('actual'))
            if e['market_data_source'] is None:e['market_data_source']='FairEconomy/ForexFactory'
            elif 'FairEconomy' not in e['market_data_source']:e['market_data_source']+=' + FairEconomy'
            matched_ff+=1
        if e['actual'] is not None and e['consensus'] is not None:e['surprise']='actual_vs_consensus'
    c['enrichment_contract']='OFFICIAL_SCHEDULE_PLUS_MARKET_CONSENSUS_ACTUAL'
    c['enrichment_note']='Official agencies remain schedule authority. Consensus/actual are populated only from matched market-data observations; missing values remain null.'
    c['enrichment_sources']=['Trading Economics API' if te else 'Trading Economics unavailable/guest-limited','FairEconomy/ForexFactory weekly public feed' if ff else 'FairEconomy unavailable']
    c['enrichment_matched']={'trading_economics':matched_te,'faireconomy':matched_ff}
    c['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CAL.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ECON_CAL_ENRICH=PASS te_rows=',len(te),'ff_rows=',len(ff),'te_matched=',matched_te,'ff_matched=',matched_ff)
if __name__=='__main__':main()
