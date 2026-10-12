#!/usr/bin/env python3
"""Lightweight cross-market freshness refresh for Observatory.

This is deliberately separate from the heavy calendar/macro builder.  It may run
frequently and only updates market observations that are safe to refresh from
public market/official sources: core US indices, US supplemental indices, KR
indices, FX, energy, metals, current Japan MOF JGB yields, crypto spot and Fear
& Greed.  The existing historical rows are preserved and merged by date.
"""
from __future__ import annotations

import csv
import io
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, time
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OBS=ROOT/'market-observatory'/'data'/'observatory.json'
KST=ZoneInfo('Asia/Seoul');ET=ZoneInfo('America/New_York')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Freshness/2.0'
YAHOO='https://query1.finance.yahoo.com/v8/finance/chart/'
JGB_CURRENT='https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv'

YAHOO_SYMBOLS={
 'NASDAQ100':'^NDX','SP500':'^GSPC','VIX':'^VIX',
 'RUSSELL2000':'^RUT','DOW':'^DJI','NASDAQCOMPOSITE':'^IXIC',
 'DXY':'DX-Y.NYB','USDKRW':'KRW=X','USDJPY':'JPY=X','JPYKRW':'JPYKRW=X',
 'WTI':'CL=F','BRENT':'BZ=F','NATGAS':'NG=F',
 'GOLD':'GC=F','SILVER':'SI=F','COPPER':'HG=F',
}
CORE=('NASDAQ100','SP500','VIX')
US_SUP=('RUSSELL2000','DOW','NASDAQCOMPOSITE')
CONTINUOUS=('DXY','USDKRW','USDJPY','JPYKRW','WTI','BRENT','NATGAS','GOLD','SILVER','COPPER')


def get_bytes(url,accept='*/*'):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept})
    with urllib.request.urlopen(req,timeout=25) as r:return r.read()

def get_json(url):return json.loads(get_bytes(url,'application/json').decode('utf-8'))

def yahoo_series(symbol):
    qs=urllib.parse.urlencode({'interval':'1d','range':'3y','includePrePost':'false','events':'div,splits'})
    obj=get_json(YAHOO+urllib.parse.quote(symbol,safe='')+'?'+qs)
    result=(((obj.get('chart') or {}).get('result') or [None])[0])
    if not result:return []
    ts=result.get('timestamp') or [];closes=((((result.get('indicators') or {}).get('quote') or [{}])[0]).get('close') or [])
    out=[]
    for stamp,value in zip(ts,closes):
        if value is None:continue
        try:value=float(value)
        except Exception:continue
        if not math.isfinite(value) or value<=0:continue
        out.append({'date':datetime.fromtimestamp(int(stamp),ET).date().isoformat(),'value':round(value,8)})
    ded={x['date']:x for x in out};return [ded[k] for k in sorted(ded)]

def merge_rows(old,new):
    ded={str(x.get('date') or '')[:10]:dict(x) for x in (old or []) if x.get('date') and x.get('value') is not None}
    for x in new or []:
        if x.get('date') and x.get('value') is not None:ded[str(x['date'])[:10]]=dict(x)
    return [ded[k] for k in sorted(ded)]

def completed_us_cutoff(now=None):
    now=(now or datetime.now(ET)).astimezone(ET)
    if now.time()<time(16,10):return (now.date()-timedelta(days=1)).isoformat()
    return now.date().isoformat()

def refresh_yahoo(data):
    sm=data.setdefault('series',{});latest=data.setdefault('latest',{});quality=data.setdefault('cross_market_freshness_quality',{})
    previous={k:list(sm.get(k) or []) for k in YAHOO_SYMBOLS}
    cutoff=completed_us_cutoff()
    fetched={}
    for key,symbol in YAHOO_SYMBOLS.items():
        try:
            rows=yahoo_series(symbol);fetched[key]=rows
        except Exception as exc:
            fetched[key]=[];quality[key]={'status':'STALE' if previous[key] else 'UNAVAILABLE','source':'Yahoo public daily','fetch_error':f'{type(exc).__name__}: {exc}'}

    date_sets=[]
    for key in CORE:
        dates={x['date'] for x in fetched.get(key,[]) if x['date']<=cutoff}
        if dates:date_sets.append(dates)
    common=max(set.intersection(*date_sets)) if len(date_sets)==len(CORE) and set.intersection(*date_sets) else None
    if common:
        data['us_completed_session_date']=common
    else:
        common=str(data.get('us_completed_session_date') or '')[:10]

    for key in CORE+US_SUP:
        fresh=[x for x in fetched.get(key,[]) if x['date']<=common]
        rows=merge_rows(previous[key],fresh)
        if common:rows=[x for x in rows if x['date']<=common]
        sm[key]=rows;latest[key]=rows[-1]['value'] if rows else None
        quality[key]={'status':'LIVE' if rows and rows[-1]['date']==common else ('LAGGING' if rows else 'UNAVAILABLE'),'source':'Yahoo public completed daily','last_date':rows[-1]['date'] if rows else None,'target_session':common}

    for key in CONTINUOUS:
        # The board is an EOD/completed-session dashboard.  Never let an in-progress
        # futures/FX daily bar jump ahead of the canonical completed US session.
        fresh=[x for x in fetched.get(key,[]) if not common or x['date']<=common]
        rows=merge_rows(previous[key],fresh)
        if common:rows=[x for x in rows if x['date']<=common]
        sm[key]=rows;latest[key]=rows[-1]['value'] if rows else None
        last=rows[-1]['date'] if rows else None
        quality[key]={'status':'LIVE' if last and (not common or last>=common) else ('LAGGING' if rows else 'UNAVAILABLE'),'source':'Yahoo public completed daily','last_date':last,'target_session':common}
    return common

def _decode_csv(blob):
    for enc in ('utf-8-sig','cp932','shift_jis','utf-8'):
        try:return blob.decode(enc)
        except Exception:pass
    return blob.decode('utf-8','ignore')

def _normalize_tenor(raw):
    s=str(raw or '').strip().lower().replace('years','y').replace('year','y').replace(' ','').replace('-','')
    for n in (2,5,10,20,30,40):
        if s in {str(n),f'{n}y',f'{n}yr'} or s.startswith(f'{n}y'):return f'{n}Y'
    return str(raw or '').strip()

def fetch_current_jgb_rows():
    text=_decode_csv(get_bytes(JGB_CURRENT));reader=csv.reader(io.StringIO(text));header=None;rows=[]
    for row in reader:
        if not row:continue
        first=str(row[0] or '').strip()
        if header is None:
            if 'date' in first.lower() or first in {'年月日','基準日'}:
                header=[_normalize_tenor(x) for x in row]
            continue
        raw=first;d=None
        for fmt in ('%Y/%m/%d','%Y-%m-%d','%Y.%m.%d'):
            try:d=datetime.strptime(raw,fmt).date().isoformat();break
            except Exception:pass
        if not d:continue
        vals={}
        for i,name in enumerate(header[1:],1):
            if i>=len(row):continue
            try:vals[name]=float(str(row[i]).replace('%','').strip())
            except Exception:vals[name]=None
        rows.append({'date':d,'values':vals})
    if not rows:raise RuntimeError('JGB_CURRENT_CSV_NO_ROWS')
    return sorted(rows,key=lambda x:x['date'])

def refresh_jgb(data):
    sm=data.setdefault('series',{});latest=data.setdefault('latest',{});quality=data.setdefault('cross_market_freshness_quality',{})
    try:
        rows=fetch_current_jgb_rows();mapping={'JP2Y':'2Y','JP5Y':'5Y','JP10Y':'10Y','JP20Y':'20Y','JP30Y':'30Y'}
        for key,tenor in mapping.items():
            fresh=[{'date':x['date'],'value':x['values'].get(tenor)} for x in rows if x['values'].get(tenor) is not None]
            merged=merge_rows(sm.get(key),fresh);sm[key]=merged;latest[key]=merged[-1]['value'] if merged else None
        if sm.get('JP2Y') and sm.get('JP10Y'):
            a={x['date']:x['value'] for x in sm['JP10Y']};b={x['date']:x['value'] for x in sm['JP2Y']};sm['JP_2S10S']=[{'date':d,'value':round(a[d]-b[d],8)} for d in sorted(set(a)&set(b))];latest['JP_2S10S']=sm['JP_2S10S'][-1]['value'] if sm['JP_2S10S'] else None
        last=max((sm.get(k) or [{}])[-1].get('date','') for k in mapping)
        quality['JP_RATES']={'status':'LIVE','source':'Japan MOF current JGB yield CSV','source_url':JGB_CURRENT,'last_date':last}
        data.setdefault('sources',{})['JP_JGB_CURRENT']='Japan MOF current JGB yield CSV (jgbcme.csv) merged with historical series'
        print('JGB_CURRENT_REFRESH=PASS last_date='+str(last))
    except Exception as exc:
        old=max(((sm.get(k) or [{}])[-1].get('date','') for k in ('JP2Y','JP5Y','JP10Y','JP30Y')),default='')
        quality['JP_RATES']={'status':'STALE' if old else 'UNAVAILABLE','source':'Japan MOF current JGB yield CSV','source_url':JGB_CURRENT,'last_date':old or None,'fetch_error':f'{type(exc).__name__}: {exc}'}
        print('JGB_CURRENT_REFRESH=WARN',quality['JP_RATES'])

def refresh_kr_and_sentiment_and_crypto(data):
    from add_observatory_equities import naver_index_recent, merge_rows as eq_merge, fear_greed_series, enrich_crypto
    sm=data.setdefault('series',{});latest=data.setdefault('latest',{});quality=data.setdefault('cross_market_freshness_quality',{})
    for key in ('KOSPI','KOSDAQ'):
        try:
            fresh,url=naver_index_recent(key);rows=eq_merge(sm.get(key),fresh);sm[key]=rows;latest[key]=rows[-1]['value'];quality[key]={'status':'LIVE','source':'Naver Finance index daily','last_date':rows[-1]['date'],'source_url':url}
        except Exception as exc:quality[key]={'status':'STALE' if sm.get(key) else 'UNAVAILABLE','source':'Naver Finance index daily','last_date':(sm.get(key) or [{}])[-1].get('date'),'fetch_error':f'{type(exc).__name__}: {exc}'}
    try:
        fg=fear_greed_series();sm['FEAR_GREED']=fg;latest['FEAR_GREED']=fg[-1]['value'] if fg else None;quality['FEAR_GREED']={'status':'LIVE' if fg else 'UNAVAILABLE','source':'FearAndGreedGraph public JSON','last_date':fg[-1]['date'] if fg else None}
    except Exception as exc:quality['FEAR_GREED']={'status':'STALE' if sm.get('FEAR_GREED') else 'UNAVAILABLE','fetch_error':f'{type(exc).__name__}: {exc}'}
    enrich_crypto(data)

def main():
    data=json.loads(OBS.read_text(encoding='utf-8'))
    session=refresh_yahoo(data)
    refresh_jgb(data)
    refresh_kr_and_sentiment_and_crypto(data)
    data['supplemental_refreshed_kst']=datetime.now(KST).isoformat(timespec='seconds')
    data['supplemental_refresh_contract']='ALL_MARKET_FAMILIES_COMPLETED_SESSION_PLUS_24X7_CRYPTO_V1'
    OBS.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('OBSERVATORY_SUPPLEMENTAL_REFRESH=PASS session='+str(session)+' refreshed_kst='+data['supplemental_refreshed_kst'])

if __name__=='__main__':main()
