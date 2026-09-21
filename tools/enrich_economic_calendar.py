#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, urllib.parse, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from calendar_actual_contract import merge_observation, retain_calendar, PROVENANCE

ROOT=Path(__file__).resolve().parents[1]
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
KST=ZoneInfo('Asia/Seoul')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Calendar/2.3'

SOURCE_ERRORS=[]

PREF={
 'Consumer Price Index':['cpi y/y','cpi m/m','core cpi y/y','core cpi m/m','inflation rate yoy','cpi yoy'],
 'Employment Situation':['non-farm employment change','non farm payrolls','unemployment rate','average hourly earnings'],
 'Producer Price Index':['ppi m/m','core ppi m/m','ppi y/y','core ppi y/y','producer prices change'],
 'Job Openings and Labor Turnover':['jolts job openings','job openings'],
 'Employment Cost Index':['employment cost index'],
 'Productivity and Costs':['nonfarm productivity','unit labour costs','unit labor costs'],
 'Personal Income and Outlays':['core pce price index m/m','core pce price index mom','pce price index y/y','personal income','personal spending'],
 'GDP':['advance gdp q/q','prelim gdp q/q','final gdp q/q','gdp growth rate qoq','gdp growth rate'],
 'U.S. Initial Jobless Claims':['initial jobless claims','unemployment claims'],
 'BOJ':['boj policy rate','interest rate decision'],
 'FOMC':['federal funds rate','fed interest rate decision'],
 'Import and Export Price Indexes':['import prices m/m','export prices m/m'],
 'Bank of England 금리 결정':['official bank rate','mpc official bank rate votes'],
 '통화정책방향':['interest rate decision'],
 '소비자물가':['inflation rate yoy','cpi'],
 '고용동향':['unemployment rate'],
 '산업활동':['industrial production yoy'],
 '생산자물가':['producer prices change','ppi yoy']
}

# One official release can contain several market-moving observations.  These
# definitions let us keep the official event as the schedule authority while
# attaching the granular Forecast/Previous/Actual rows investors actually use.
DETAIL_GROUPS={
 'Consumer Price Index':[
   {'key':'cpi_yoy','label':'CPI YoY','aliases':['cpi y/y','cpi yoy'],'forbid':['core']},
   {'key':'cpi_mom','label':'CPI MoM','aliases':['cpi m/m','cpi mom'],'forbid':['core']},
   {'key':'core_cpi_yoy','label':'Core CPI YoY','aliases':['core cpi y/y','core cpi yoy']},
   {'key':'core_cpi_mom','label':'Core CPI MoM','aliases':['core cpi m/m','core cpi mom']},
 ],
 'Employment Situation':[
   {'key':'nfp','label':'Nonfarm Payrolls','aliases':['non-farm employment change','non farm employment change','nonfarm payrolls','non farm payrolls']},
   {'key':'unemployment','label':'Unemployment Rate','aliases':['unemployment rate']},
   {'key':'avg_hourly_mom','label':'Average Hourly Earnings MoM','aliases':['average hourly earnings m/m','average hourly earnings mom']},
   {'key':'avg_hourly_yoy','label':'Average Hourly Earnings YoY','aliases':['average hourly earnings y/y','average hourly earnings yoy']},
 ],
 'Producer Price Index':[
   {'key':'ppi_mom','label':'PPI MoM','aliases':['ppi m/m','ppi mom'],'forbid':['core']},
   {'key':'ppi_yoy','label':'PPI YoY','aliases':['ppi y/y','ppi yoy'],'forbid':['core']},
   {'key':'core_ppi_mom','label':'Core PPI MoM','aliases':['core ppi m/m','core ppi mom']},
   {'key':'core_ppi_yoy','label':'Core PPI YoY','aliases':['core ppi y/y','core ppi yoy']},
 ],
 'Job Openings and Labor Turnover':[
   {'key':'jolts','label':'JOLTS Job Openings','aliases':['jolts job openings','job openings']},
 ],
 'Employment Cost Index':[
   {'key':'eci','label':'Employment Cost Index','aliases':['employment cost index']},
 ],
 'Productivity and Costs':[
   {'key':'productivity','label':'Nonfarm Productivity','aliases':['nonfarm productivity']},
   {'key':'unit_labor','label':'Unit Labor Costs','aliases':['unit labor costs','unit labour costs']},
 ],
 'Personal Income and Outlays':[
   {'key':'core_pce_mom','label':'Core PCE MoM','aliases':['core pce price index m/m','core pce price index mom']},
   {'key':'pce_yoy','label':'PCE Price Index YoY','aliases':['pce price index y/y','pce price index yoy']},
   {'key':'personal_income','label':'Personal Income MoM','aliases':['personal income m/m','personal income mom']},
   {'key':'personal_spending','label':'Personal Spending MoM','aliases':['personal spending m/m','personal spending mom']},
 ],
 'GDP':[
   {'key':'gdp_qoq','label':'GDP QoQ','aliases':['advance gdp q/q','prelim gdp q/q','final gdp q/q','gdp q/q']},
 ],
 'FOMC':[
   {'key':'fed_rate','label':'Federal Funds Rate','aliases':['federal funds rate']},
 ],
 'Import and Export Price Indexes':[
   {'key':'us_import_price_mom','label':'U.S. Import Prices MoM','aliases':['import prices m/m','import prices mom']},
   {'key':'us_export_price_mom','label':'U.S. Export Prices MoM','aliases':['export prices m/m','export prices mom']},
 ],
 'Bank of England 금리 결정':[
   {'key':'boe_bank_rate','label':'Bank of England Bank Rate','aliases':['official bank rate'],'forbid':['votes']},
   {'key':'boe_vote_split','label':'MPC 금리투표 (인상-인하-동결)','aliases':['mpc official bank rate votes']},
 ],
}

def norm(s):return re.sub(r'[^a-z0-9가-힣]+',' ',str(s or '').lower()).strip()
def req_json(url):
    r=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(r,timeout=25) as x:return json.load(x)

def te_rows():
    key=(os.getenv('TRADING_ECONOMICS_API_KEY') or '').strip();cred=key if key else 'guest:guest'
    now=datetime.now(KST).date();start=(now-timedelta(days=120)).isoformat();end=(now+timedelta(days=240)).isoformat();countries=urllib.parse.quote('united states,south korea,japan,united kingdom',safe=',')
    url=f'https://api.tradingeconomics.com/calendar/country/{countries}/{start}/{end}?c={urllib.parse.quote(cred,safe=":")}'
    try:
        obj=req_json(url);return obj if isinstance(obj,list) else []
    except Exception as exc:
        SOURCE_ERRORS.append({'source':'Trading Economics','error':type(exc).__name__,'http_status':getattr(exc,'code',None)})
        return []

def ff_rows():
    out=[]
    for name in ['lastweek','thisweek','nextweek']:
        try:
            xs=req_json(f'https://nfs.faireconomy.media/ff_calendar_{name}.json')
            if isinstance(xs,list):
                for row in xs: row['_source_url']=f'https://nfs.faireconomy.media/ff_calendar_{name}.json'
                out.extend(xs)
        except Exception as exc:
            SOURCE_ERRORS.append({'source':'FairEconomy/'+name,'error':type(exc).__name__,'http_status':getattr(exc,'code',None)})
    return out

def prefs_for(title):
    t=norm(title)
    for k,v in PREF.items():
        if norm(k) in t:return v
    return []

def detail_specs(title):
    from official_bls_actuals import DEFS,LABELS
    if title in ('State Job Openings and Labor Turnover','Employment Situation of Veterans'):
        return [dict(key=k,label=LABELS[k],aliases=[]) for k in DEFS[title][1]]
    if title.startswith('Productivity and Costs by Industry:') and title in DEFS:
        return [dict(key=k,label=LABELS.get(k,k),aliases=[]) for k in DEFS[title][1]]
    t=norm(title)
    for k,v in DETAIL_GROUPS.items():
        if norm(k) in t:return v
    return []

def event_date(e):return str(e.get('datetime_kst') or '')[:10]
def clean(v):
    if v is None:return None
    s=str(v).strip();return None if s in ('','None','null','nan','N/A','-') else s

def row_kst_date(row):
    try:return datetime.fromisoformat(str(row.get('date'))).astimezone(KST).date().isoformat()
    except:return ''

def date_delta(a,b):
    try:return abs((datetime.fromisoformat(a).date()-datetime.fromisoformat(b).date()).days)
    except:return 999

def score_te(event,row):
    ec={'US':'united states','KR':'south korea','GB':'united kingdom','JP':'japan'}.get(event.get('country'),'__unsupported__');rc=norm(row.get('Country'))
    if ec not in rc:return -999
    delta=date_delta(event_date(event),str(row.get('Date') or '')[:10])
    if delta>1:return -999
    s=20 if delta==0 else 10;rtxt=norm((row.get('Event') or '')+' '+(row.get('Category') or ''));prefs=prefs_for(event.get('title'))
    for i,p in enumerate(prefs):
        if norm(p) in rtxt:s+=18-i*3
    return s if prefs else -999

def score_ff(event,row):
    currency={'US':'USD','GB':'GBP','JP':'JPY','KR':'KRW'}.get(event.get('country'))
    if not currency or str(row.get('country') or '').upper()!=currency:return -999
    delta=date_delta(event_date(event),row_kst_date(row))
    if delta>1:return -999
    prefs=prefs_for(event.get('title'))
    if not prefs:return -999
    s=20 if delta==0 else 10;rtxt=norm(row.get('title'));hits=0
    for i,p in enumerate(prefs):
        if norm(p) in rtxt:s+=20-i*3;hits+=1
    return s if hits else -999

def best_match(event,rows,scorer,threshold=30):
    best=None;bs=-999
    for r in rows:
        sc=scorer(event,r)
        if sc>bs:best,bs=r,sc
    return (best,bs) if best is not None and bs>=threshold else (None,bs)

def set_if_present(e,key,val):
    v=clean(val)
    if v is not None:e[key]=v

def metric_match(event,spec,rows):
    currency={'US':'USD','GB':'GBP','JP':'JPY','KR':'KRW'}.get(event.get('country'))
    if not currency:return None
    best=None;best_score=-999
    ed=event_date(event)
    for row in rows:
        if str(row.get('country') or '').upper()!=currency:continue
        delta=date_delta(ed,row_kst_date(row))
        if delta>1:continue
        title=norm(row.get('title'))
        if any(norm(x) in title for x in spec.get('forbid',[])):continue
        aliases=[norm(x) for x in spec.get('aliases',[])]
        hits=[a for a in aliases if a and a in title]
        if not hits:continue
        # Prefer exact release date and the longest/specific alias.
        score=(100 if delta==0 else 50)+max(len(x) for x in hits)
        if score>best_score:best,best_score=row,score
    return best

def merge_metric(old,spec,row):
    if not row:
        m=dict(old or {});m.update(key=spec['key'],label=spec['label'])
        for k in ['previous','consensus','actual']:m.setdefault(k,None)
        return m
    m={}
    m['key']=spec['key'];m['label']=spec['label'];m['source']='FairEconomy/ForexFactory';m['source_tier']='MARKET_FEED';m['source_url']='https://nfs.faireconomy.media/ff_calendar_thisweek.json';m['checked_kst']=datetime.now(KST).isoformat(timespec='seconds');m['verification_status']='MARKET_REPORTED'
    if row:
        m['source_url']=row.get('_source_url') or m['source_url']
        m['event_title']=clean(row.get('title'))
        m['datetime_source']=clean(row.get('date'))
        m['impact']=clean(row.get('impact'))
        for dst,src in [('previous','previous'),('consensus','forecast'),('actual','actual')]:
            v=clean(row.get(src))
            if v is not None:m[dst]=v
    for k in ['previous','consensus','actual']:m.setdefault(k,None)
    return merge_observation(old or {},m)

def apply_detailed_metrics(event,ff):
    specs=detail_specs(event.get('title'))
    old={m.get('key'):m for m in (event.get('market_metrics') or []) if isinstance(m,dict) and m.get('key')}
    if not specs:
        event.setdefault('market_metrics',list(old.values()))
        return 0,0,0
    metrics=[];matched=actual_updates=forecast_updates=0
    for spec in specs:
        row=metric_match(event,spec,ff)
        before=old.get(spec['key']) or {}
        m=merge_metric(before,spec,row)
        if row:
            matched+=1
            actual_updates+=int(clean(before.get('actual'))!=clean(m.get('actual')) and clean(m.get('actual')) is not None)
            forecast_updates+=int(clean(before.get('consensus'))!=clean(m.get('consensus')) and clean(m.get('consensus')) is not None)
        # Keep configured rows even when not yet published so the UI clearly shows what is awaited.
        metrics.append(m)
    metrics.extend(m for key,m in old.items() if key not in {s['key'] for s in specs})
    removed=set((event.get('metric_contract_correction') or {}).get('removed_keys',[]))
    event['market_metrics']=[m for m in metrics if m['key'] not in removed]
    # Backward-compatible representative values for compact clients.
    primary=next((m for m in metrics if any(m.get(k) is not None for k in ['previous','consensus','actual'])),None)
    if primary:
        for k in ['previous','consensus','actual']:
            if primary.get(k) is not None:
                if k=='actual':
                    if event.get('source_tier')=='SECONDARY' and primary.get('source_tier')=='MARKET_FEED':
                        primary.update({f:event[f] for f in ['actual',*PROVENANCE] if f in event})
                    event.update(merge_observation(event,{f:primary[f] for f in ['actual',*PROVENANCE] if f in primary}))
                else:event[k]=primary[k]
    return matched,actual_updates,forecast_updates

def main():
    c=json.loads(CAL.read_text(encoding='utf-8'))
    from calendar_market_events import apply_overrides
    from refresh_official_central_bank_actuals import apply_fomc_official_actual
    from official_calendar_collectors import apply_official_actuals
    from calendar_actual_contract import build_freshness
    apply_overrides(c)
    now=datetime.now(KST)
    _,fed_checks=apply_fomc_official_actual(c,now)
    _,checks=apply_official_actuals(c,now)
    te=te_rows();ff=ff_rows()
    matched_te=matched_ff_events=matched_ff_metrics=0;actual_updates=forecast_updates=0
    for e in c.get('events') or []:
        for k in ['previous','consensus','actual','te_forecast','surprise','market_data_source']:
            e.setdefault(k,None)
        e.setdefault('market_metrics',[])

        r,score=best_match(e,te,score_te)
        if r:
            before_a=e.get('actual');before_c=e.get('consensus')
            e.update(merge_observation(e,{'previous':r.get('Previous'),'consensus':r.get('Forecast'),'actual':r.get('Actual'),'source_tier':'SECONDARY','actual_source':'Trading Economics','source_url':r.get('URL') or 'https://tradingeconomics.com/calendar','checked_kst':now.isoformat(timespec='seconds'),'verification_status':'MARKET_REPORTED'}));set_if_present(e,'te_forecast',r.get('TEForecast'))
            e['market_data_source']='Trading Economics';e['market_match_score']=score;matched_te+=1
            actual_updates+=int(before_a!=e.get('actual') and e.get('actual') is not None);forecast_updates+=int(before_c!=e.get('consensus') and e.get('consensus') is not None)

        f,score=best_match(e,ff,score_ff)
        if f:
            before_a=e.get('actual');before_c=e.get('consensus')
            e.update(merge_observation(e,{'previous':f.get('previous'),'consensus':f.get('forecast'),'actual':f.get('actual'),'source_tier':'MARKET_FEED','actual_source':'FairEconomy/ForexFactory','source_url':f.get('_source_url') or 'https://nfs.faireconomy.media/ff_calendar_thisweek.json','checked_kst':now.isoformat(timespec='seconds'),'verification_status':'MARKET_REPORTED'}))
            if e.get('market_data_source') is None:e['market_data_source']='FairEconomy/ForexFactory'
            elif 'FairEconomy' not in e['market_data_source']:e['market_data_source']+=' + FairEconomy/ForexFactory'
            e['ff_match_score']=score;matched_ff_events+=1
            actual_updates+=int(before_a!=e.get('actual') and e.get('actual') is not None);forecast_updates+=int(before_c!=e.get('consensus') and e.get('consensus') is not None)

        mm,au,fu=apply_detailed_metrics(e,ff);matched_ff_metrics+=mm;actual_updates+=au;forecast_updates+=fu
        if mm and e.get('market_data_source') is None:e['market_data_source']='FairEconomy/ForexFactory'
        elif mm and 'FairEconomy' not in str(e.get('market_data_source') or ''):e['market_data_source']=(str(e.get('market_data_source') or '')+' + FairEconomy/ForexFactory').strip(' +')
        if e.get('actual') is not None and e.get('consensus') is not None:e['surprise']='actual_vs_consensus'

    c['enrichment_errors']=SOURCE_ERRORS
    c['actual_freshness']=build_freshness(c,now,fed_checks+checks)
    c['official_actual_contract']='OFFICIAL_REGISTRY_BACKFILL_V2'
    c['enrichment_contract']='OFFICIAL_SCHEDULE_PLUS_MARKET_CONSENSUS_ACTUAL_V2'
    c['enrichment_note']='Official agencies remain schedule authority. U.S. releases are decomposed into granular market_metrics from FairEconomy/ForexFactory. Captured observations persist after weekly feeds roll forward; missing values are never invented.'
    c['enrichment_sources']=['Trading Economics API' if te else 'Trading Economics unavailable/guest-limited','FairEconomy/ForexFactory weekly public feed' if ff else 'FairEconomy unavailable']
    c['enrichment_matched']={'trading_economics':matched_te,'faireconomy_events':matched_ff_events,'faireconomy_metrics':matched_ff_metrics}
    c['enrichment_updates']={'actual':actual_updates,'forecast':forecast_updates}
    c['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    CAL.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ECON_CAL_ENRICH_V2=PASS te_rows=',len(te),'ff_rows=',len(ff),'te_matched=',matched_te,'ff_events=',matched_ff_events,'ff_metrics=',matched_ff_metrics,'actual_updates=',actual_updates,'forecast_updates=',forecast_updates)
if __name__=='__main__':main()
