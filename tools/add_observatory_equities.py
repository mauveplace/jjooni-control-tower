#!/usr/bin/env python3
from __future__ import annotations
import json, math, urllib.parse, urllib.request
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OBS=ROOT/'market-observatory'/'data'/'observatory.json'
KST=ZoneInfo('Asia/Seoul');ET=ZoneInfo('America/New_York');UTC=ZoneInfo('UTC')
YAHOO='https://query1.finance.yahoo.com/v8/finance/chart/'
FEAR_GREED='https://fearandgreedgraph.com/api/fear-greed'
UA='Mozilla/5.0 JJOONI-Market-Observatory/1.0'

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

CRYPTO_SYMBOLS={'BTCUSD':'BTC-USD','ETHUSD':'ETH-USD'}

def crypto_observation(symbol, now=None):
    qs=urllib.parse.urlencode({'interval':'1d','range':'3y','includePrePost':'false'})
    url=YAHOO+urllib.parse.quote(symbol,safe='')+'?'+qs
    obj=get_json(url)
    now=now or datetime.now(UTC)
    rs=((obj.get('chart') or {}).get('result') or [])
    if not rs:raise ValueError('CRYPTO_SOURCE_EMPTY')
    result=rs[0];meta=result.get('meta') or {}
    closes=(((result.get('indicators') or {}).get('quote') or [{}])[0]).get('close') or []
    rows={}
    today=now.astimezone(UTC).date().isoformat()
    for stamp, value in zip(result.get('timestamp') or [],closes):
        if value is None:continue
        value=float(value)
        if not math.isfinite(value) or value<=0:continue
        day=datetime.fromtimestamp(int(stamp),UTC).date().isoformat()
        if day>today:continue
        rows[day]={'date':day,'value':round(value,8),'session_status':'IN_PROGRESS' if day==today else 'COMPLETED','date_basis':'UTC'}
    price=meta.get('regularMarketPrice');stamp=meta.get('regularMarketTime')
    if price is None or stamp is None:raise ValueError('CRYPTO_QUOTE_METADATA_MISSING')
    price=float(price)
    if not math.isfinite(price) or price<=0:raise ValueError('CRYPTO_QUOTE_INVALID')
    observed=datetime.fromtimestamp(int(stamp),UTC)
    age=(now.astimezone(UTC)-observed).total_seconds()
    if age < -300:raise ValueError('CRYPTO_QUOTE_FUTURE_TIMESTAMP')
    day=observed.date().isoformat()
    rows[day]={'date':day,'value':round(price,8),'session_status':'IN_PROGRESS' if day==today else 'COMPLETED','date_basis':'UTC','observed_kst':observed.astimezone(KST).isoformat(timespec='seconds')}
    snapshot={'symbol':symbol,'source':'Yahoo Finance spot crypto quote + UTC daily candles','source_url':url,'price':price,'quote_as_of_kst':observed.astimezone(KST).isoformat(timespec='seconds'),'captured_kst':now.astimezone(KST).isoformat(timespec='seconds'),'status':'LIVE' if age<=3600 else 'STALE','quote_age_seconds':max(0,int(age)),'comparison_basis':'UTC_DAILY_CLOSE_NOT_ROLLING_24H','market_hours':'24/7'}
    return [rows[d] for d in sorted(rows)],snapshot


def retain_crypto_observations(current, previous):
    # A full market rebuild must not erase last-good crypto before refresh.
    for key in CRYPTO_SYMBOLS:
        rows=(previous.get('series') or {}).get(key)
        if rows and not (current.get('series') or {}).get(key):
            current.setdefault('series',{})[key]=deepcopy(rows)
            current.setdefault('latest',{})[key]=rows[-1]['value']
            old=deepcopy((previous.get('crypto_market') or {}).get(key) or {})
            old.update(status='STALE',refresh_state='AWAITING_REFRESH')
            current.setdefault('crypto_market',{})[key]=old
    return current


def enrich_crypto(data):
    series_map=data.setdefault('series',{});latest=data.setdefault('latest',{});snapshots=data.setdefault('crypto_market',{})
    for key,symbol in CRYPTO_SYMBOLS.items():
        try:
            rows,snapshot=crypto_observation(symbol)
            series_map[key]=rows;latest[key]=rows[-1]['value']
            snapshots[key]=snapshot
            print('CRYPTO_QUOTE=PASS',key,snapshot['status'],'price=',snapshot['price'],'as_of=',snapshot['quote_as_of_kst'])
        except Exception as exc:
            old=dict(snapshots.get(key) or {})
            old.update(status='STALE' if series_map.get(key) else 'UNAVAILABLE',fetch_error=f'{type(exc).__name__}: {exc}',last_attempt_kst=datetime.now(KST).isoformat(timespec='seconds'))
            snapshots[key]=old
            print('CRYPTO_QUOTE=WARN',key,old['status'],old['fetch_error'])
    data.setdefault('sources',{})['CRYPTO_SPOT']='Yahoo Finance BTC-USD / ETH-USD; UTC daily candles; quote observation timestamp preserved'
    data['crypto_contract']='SPOT_QUOTE_WITH_UTC_DAILY_COMPARISON_V1'


def fear_greed_series():
    obj=get_json(FEAR_GREED)
    dates=obj.get('dates') or []
    values=obj.get('values') or []
    out=[]
    for d,v in zip(dates,values):
        try:v=float(v)
        except:continue
        if not math.isfinite(v):continue
        d=str(d)[:10]
        if len(d)==10:out.append({'date':d,'value':round(v,4)})
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
    enrich_crypto(data)
    try:fg=fear_greed_series()
    except Exception as e:
        print(f'FEAR_GREED_FETCH_WARN={e}');fg=prev.get('FEAR_GREED',[])
    sm['FEAR_GREED']=fg
    latest['FEAR_GREED']=fg[-1]['value'] if fg else None
    src['KR_EQUITY']='Yahoo public daily (^KS11/^KQ11)'
    src['GLOBAL_EQUITY_SUPPLEMENT']='Yahoo public daily (^RUT/^DJI/^IXIC)'
    src['SILVER']='Yahoo public daily (SI=F)'
    src['FEAR_GREED']='FearAndGreedGraph public JSON (CNN-derived sentiment reference)'
    data['equity_enrichment_contract']='KOSPI_KOSDAQ_DAILY_REFERENCE_V1'
    data['market_supplement_contract']='GLOBAL_INDEX_SILVER_SENTIMENT_DAILY_REFERENCE_V2'
    data['equity_enriched_kst']=datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('OBSERVATORY_MARKET_SUPPLEMENT=PASS',
          'KOSPI=',latest.get('KOSPI'),
          'KOSDAQ=',latest.get('KOSDAQ'),
          'RUT=',latest.get('RUSSELL2000'),
          'DOW=',latest.get('DOW'),
          'IXIC=',latest.get('NASDAQCOMPOSITE'),
          'SILVER=',latest.get('SILVER'),
          'FEAR_GREED=',latest.get('FEAR_GREED'))

if __name__=='__main__':main()

