#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, math, urllib.parse, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'market-observatory'/'data'
OBS=DATA/'observatory.json'
ARCH=DATA/'history-30y.json'
KST=ZoneInfo('Asia/Seoul'); ET=ZoneInfo('America/New_York')
UA='Mozilla/5.0 JJOONI-Market-Observatory-History/2.0'
YAHOO='https://query1.finance.yahoo.com/v8/finance/chart/'
SYMBOLS={
 'NASDAQ100':'^NDX','SP500':'^GSPC','VIX':'^VIX','DXY':'DX-Y.NYB',
 'USDKRW':'KRW=X','USDJPY':'JPY=X','JPYKRW':'JPYKRW=X',
 'WTI':'CL=F','BRENT':'BZ=F','NATGAS':'NG=F','GOLD':'GC=F','COPPER':'HG=F',
 'US3M':'^IRX','US5Y':'^FVX','US10Y':'^TNX','US30Y':'^TYX'
}

def req(url,timeout=25,accept='*/*'):
    r=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept})
    with urllib.request.urlopen(r,timeout=timeout) as x:return x.read()

def get_json(url):return json.loads(req(url,accept='application/json').decode('utf-8'))
def get_text(url):return req(url).decode('utf-8-sig','ignore')
def merge(a,b):
    d={str(x.get('date')):x for x in (a or []) if x.get('date')};d.update({str(x.get('date')):x for x in (b or []) if x.get('date')});return [d[k] for k in sorted(d)]
def trim(xs,cutoff):return [x for x in xs if str(x.get('date',''))>=cutoff]
def old_enough(xs,cutoff):return bool(xs and str(xs[0].get('date',''))<=cutoff[:4]+'-12-31')

def yahoo_max(symbol):
    qs=urllib.parse.urlencode({'interval':'1d','range':'max','includePrePost':'false','events':'div,splits'})
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
        out.append({'date':datetime.fromtimestamp(int(t),ET).date().isoformat(),'value':round(v,8)})
    return merge([],out)

def treasury_year(year):
    url=f'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve&field_tdr_date_value={year}&page&_format=csv'
    rows=[]
    for r in csv.DictReader(io.StringIO(get_text(url))):
        raw=r.get('Date') or ''
        try:d=datetime.strptime(raw.strip(),'%m/%d/%Y').date().isoformat()
        except:continue
        vals={}
        for col in ['2 Yr','5 Yr','10 Yr','30 Yr']:
            try:vals[col]=float(r.get(col) or '')
            except:vals[col]=None
        rows.append({'date':d,'values':vals})
    return rows

def fred_csv(series_id):
    url='https://fred.stlouisfed.org/graph/fredgraph.csv?id='+urllib.parse.quote(series_id)
    out=[]
    for r in csv.DictReader(io.StringIO(get_text(url))):
        d=r.get('DATE') or r.get('observation_date') or ''
        raw=r.get(series_id)
        try:v=float(raw)
        except:continue
        if d:out.append({'date':d,'value':round(v,8),'frequency':'monthly','source':'OECD/FRED'})
    return out

def main():
    o=json.loads(OBS.read_text(encoding='utf-8'))
    try:a=json.loads(ARCH.read_text(encoding='utf-8'))
    except:a={'schema':'JJOONI_MARKET_HISTORY_30Y_V1','series':{}}
    series=a.setdefault('series',{})
    current=o.get('series') or {}
    now=datetime.now(KST).date();cutoff=(now-timedelta(days=365*30+10)).isoformat()
    quality={}
    for k,sym in SYMBOLS.items():
        base=merge(series.get(k),current.get(k))
        if not old_enough(base,cutoff):
            try:base=merge(base,yahoo_max(sym));quality[k]='BACKFILLED_MAX'
            except Exception as e:quality[k]='BACKFILL_FAILED:'+type(e).__name__
        else:quality[k]='ARCHIVE_PLUS_INCREMENT'
        series[k]=trim(base,cutoff)
    # Official U.S. Treasury: initial 30Y backfill once, then current output increments are merged.
    official=[('US2Y','2 Yr'),('US5Y_OFFICIAL','5 Yr'),('US10Y_OFFICIAL','10 Yr'),('US30Y_OFFICIAL','30 Yr')]
    need_us=not old_enough(series.get('US10Y_OFFICIAL'),cutoff)
    usrows=[]
    if need_us:
        for y in range(now.year-30,now.year+1):
            try:usrows.extend(treasury_year(y))
            except:pass
    for key,col in official:
        fresh=[{'date':x['date'],'value':x['values'][col],'source':'US Treasury'} for x in usrows if x['values'].get(col) is not None]
        series[key]=trim(merge(series.get(key),merge(current.get(key),fresh)),cutoff)
    if series.get('US2Y') and series.get('US10Y_OFFICIAL'):
        a10={x['date']:x['value'] for x in series['US10Y_OFFICIAL']};a2={x['date']:x['value'] for x in series['US2Y']}
        series['US_2S10S']=[{'date':d,'value':round(a10[d]-a2[d],8)} for d in sorted(set(a10)&set(a2))]
    # Korea 10Y long history: OECD monthly series via FRED, then daily ECOS observations override recent dates.
    try:
        kr10=fred_csv('IRLTLT01KRM156N')
        series['KR10Y']=trim(merge(kr10,merge(series.get('KR10Y'),current.get('KR10Y'))),cutoff)
        quality['KR10Y_LONG']='OECD_FRED_MONTHLY_PLUS_ECOS_DAILY'
    except Exception as e:quality['KR10Y_LONG']='FAILED:'+type(e).__name__
    # Preserve/merge every other series already produced by the daily builder (including JGB long history).
    for k,v in current.items():series[k]=trim(merge(series.get(k),v),cutoff)
    # Re-derive spreads on common observed dates. Short gaps are visual-only bridged in the UI; no fake data is created here.
    def derive(a,b,name):
        ma={x['date']:x['value'] for x in series.get(a,[]) if x.get('value') is not None};mb={x['date']:x['value'] for x in series.get(b,[]) if x.get('value') is not None}
        series[name]=[{'date':d,'value':round(ma[d]-mb[d],8)} for d in sorted(set(ma)&set(mb))]
    derive('US10Y_OFFICIAL','US2Y','US_2S10S');derive('KR10Y','KR3Y','KR_3S10S');derive('JP10Y','JP2Y','JP_2S10S')
    a['generated_kst']=datetime.now(KST).isoformat(timespec='seconds');a['history_contract']='INITIAL_BACKFILL_THEN_INCREMENTAL';a['target_years']=30;a['quality']=quality
    ARCH.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    o['series']=series;o['generated_kst']=a['generated_kst'];o['history_contract']=a['history_contract'];o['history_target_years']=30;o['history_quality']=quality
    latest=o.setdefault('latest',{})
    for k,v in series.items():
        if v and isinstance(v,list) and isinstance(v[-1],dict) and 'value' in v[-1]:latest[k]=v[-1].get('value')
    if latest.get('KR10Y') is not None and latest.get('US10Y_OFFICIAL') is not None:latest['KR_US_10Y']=round(latest['KR10Y']-latest['US10Y_OFFICIAL'],8)
    OBS.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('MARKET_HISTORY_30Y=PASS series=',len(series),'cutoff=',cutoff,'US10Y_oldest=',series.get('US10Y_OFFICIAL',[{}])[0].get('date'),'KR10Y_oldest=',series.get('KR10Y',[{}])[0].get('date'))
if __name__=='__main__':main()
