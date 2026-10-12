#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, date
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'market-observatory'/'data'
OUT=DATA/'data-audit.json'
KST=ZoneInfo('Asia/Seoul')

EXPECTED_SERIES={
  'core_us':['NASDAQ100','SP500','VIX'],
  'us_supplement':['RUSSELL2000','DOW','NASDAQCOMPOSITE'],
  'kr_equity':['KOSPI','KOSDAQ'],
  'fx':['DXY','USDKRW','USDJPY','JPYKRW'],
  'energy':['WTI','BRENT','NATGAS'],
  'metals':['GOLD','SILVER','COPPER'],
  'us_rates':['US3M','US2Y','US5Y_OFFICIAL','US10Y_OFFICIAL','US30Y_OFFICIAL','US_2S10S'],
  'kr_rates':['KR3Y','KR5Y','KR10Y','KR20Y','KR30Y','KR_3S10S'],
  'jp_rates':['JP2Y','JP5Y','JP10Y','JP30Y','JP_2S10S'],
  'crypto':['BTCUSD','ETHUSD'],
  'sentiment':['FEAR_GREED'],
}

def load(path, default=None):
    try:return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception:return {} if default is None else default

def days_between(a,b):
    try:return (date.fromisoformat(a)-date.fromisoformat(b)).days
    except Exception:return None

def point(rows):
    rows=rows or []
    if not rows:return {'count':0,'last_date':None,'last_value':None}
    x=rows[-1] or {}
    return {'count':len(rows),'last_date':str(x.get('date') or '')[:10] or None,'last_value':x.get('value')}

def state_from_dates(dates,anchor=None,allow_lag_days=0):
    dates=[d for d in dates if d]
    if not dates:return 'UNAVAILABLE'
    if not anchor:return 'LIVE'
    min_d=min(dates);max_d=max(dates)
    lag=days_between(anchor,min_d)
    if lag is None:return 'UNAVAILABLE'
    if max_d>anchor:return 'AHEAD_OF_ANCHOR'
    if lag>allow_lag_days:return 'LAGGING'
    return 'LIVE'

def build():
    now=datetime.now(KST)
    obs=load(DATA/'observatory.json');pulse=load(DATA/'daily-market-pulse.json');public=load(ROOT/'public-market-daily.json')
    fed=load(DATA/'fed-watch.json');cal=load(DATA/'economic-calendar.json');sector=load(DATA/'sector-etf.json')
    macro=load(DATA/'official-macro.json');regime=load(DATA/'market-regime.json');fresh=load(DATA/'freshness-status.json');watchdog=load(DATA/'watchdog-status.json')
    series=obs.get('series') or {};latest=obs.get('latest') or {};session=str(obs.get('us_completed_session_date') or '')[:10] or None
    per_series={}
    for group,keys in EXPECTED_SERIES.items():
        for k in keys:
            p=point(series.get(k));p.update(group=group,latest_value=latest.get(k),latest_matches=(latest.get(k)==p['last_value']) if p['last_value'] is not None else False);per_series[k]=p
    groups={}
    def make_group(name,keys,anchor=None,allow_lag_days=0,critical=False):
        items={k:per_series.get(k,point(series.get(k))) for k in keys};dates=[v.get('last_date') for v in items.values()];missing=[k for k,v in items.items() if not v.get('last_date')];mismatched=[k for k,v in items.items() if v.get('last_value') is not None and latest.get(k)!=v.get('last_value')]
        state='UNAVAILABLE' if missing else state_from_dates(dates,anchor,allow_lag_days)
        if mismatched and state=='LIVE':state='INCONSISTENT'
        groups[name]={'state':state,'anchor':anchor,'allow_lag_days':allow_lag_days,'critical':critical,'items':items,'missing':missing,'latest_mismatch':mismatched}
    make_group('core_us',EXPECTED_SERIES['core_us'],session,0,True);make_group('us_supplement',EXPECTED_SERIES['us_supplement'],session,0,False);make_group('kr_equity',EXPECTED_SERIES['kr_equity'],None,0,True)
    make_group('fx',EXPECTED_SERIES['fx'],session,1,False);make_group('energy',EXPECTED_SERIES['energy'],session,1,False);make_group('metals',EXPECTED_SERIES['metals'],session,1,False)
    make_group('us_rates',EXPECTED_SERIES['us_rates'],session,3,False);make_group('kr_rates',EXPECTED_SERIES['kr_rates'],None,3,False);make_group('jp_rates',EXPECTED_SERIES['jp_rates'],None,3,False);make_group('crypto',EXPECTED_SERIES['crypto'],None,0,False);make_group('sentiment',EXPECTED_SERIES['sentiment'],session,2,False)
    pulse_session=str(pulse.get('market_date_us') or '')[:10] or None;tripod=(public.get('tripod_signal') or {});tripod_session=str(tripod.get('date') or tripod.get('session_date') or '')[:10] or None
    supplement=(obs.get('market_supplement_quality') or {});us_sup_quality={k:(supplement.get(k) or {}) for k in EXPECTED_SERIES['us_supplement']};kr_quality={k:(supplement.get(k) or {}) for k in EXPECTED_SERIES['kr_equity']}
    crypto_market=obs.get('crypto_market') or {};crypto_status={k:{'status':(crypto_market.get(k) or {}).get('status'),'quote_as_of_kst':(crypto_market.get(k) or {}).get('quote_as_of_kst'),'quote_age_seconds':(crypto_market.get(k) or {}).get('quote_age_seconds')} for k in EXPECTED_SERIES['crypto']}
    file_status={'observatory':{'generated_kst':obs.get('generated_kst'),'session':session,'schema':obs.get('schema')},'daily_pulse':{'generated_kst':pulse.get('generated_kst'),'session':pulse_session,'snapshot_status':pulse.get('snapshot_status')},'public_tripod':{'generated_kst':public.get('generated_kst'),'session':tripod_session,'ok':tripod.get('ok'),'target':tripod.get('target')},'fedwatch':{'generated_kst':fed.get('generated_kst'),'market_data_as_of':fed.get('market_data_as_of'),'expected_market_data_date':fed.get('expected_market_data_date'),'declared_freshness':fed.get('freshness')},'calendar':{'generated_kst':cal.get('generated_kst'),'events':len(cal.get('events') or []),'actual_freshness':(cal.get('actual_freshness') or {}).get('status')},'sector':{'generated_kst':sector.get('generated_kst'),'as_of_date':sector.get('as_of_date'),'priced_count':(sector.get('summary') or {}).get('priced_count')},'official_macro':{'generated_kst':macro.get('generated_kst'),'schema':macro.get('schema')},'market_regime':{'status':regime.get('status'),'effective_window':regime.get('effective_window'),'source_generated_kst':(regime.get('source') or {}).get('generated_kst')},'freshness':{'generated_kst':fresh.get('generated_kst'),'overall':fresh.get('overall'),'critical_bad':fresh.get('critical_bad'),'warnings':fresh.get('warnings')},'watchdog':{'checked_kst':watchdog.get('checked_kst'),'result':watchdog.get('result'),'decision':watchdog.get('decision')}}
    issues=[]
    def issue(code,severity,detail):issues.append({'code':code,'severity':severity,'detail':detail})
    if not session:issue('NO_US_SESSION','CRITICAL','observatory.us_completed_session_date missing')
    if pulse_session!=session:issue('PULSE_SESSION_MISMATCH','CRITICAL',f'pulse={pulse_session} observatory={session}')
    if tripod_session!=session or tripod.get('ok') is not True:issue('TRIPOD_SESSION_MISMATCH','CRITICAL',f'tripod={tripod_session} ok={tripod.get("ok")} observatory={session}')
    for name,g in groups.items():
        if g['state']!='LIVE':issue('GROUP_'+name.upper()+'_'+g['state'],'CRITICAL' if g.get('critical') else 'WARN',f"anchor={g.get('anchor')} dates="+','.join(f"{k}:{v.get('last_date')}" for k,v in g['items'].items()))
    fed_asof=str(fed.get('market_data_as_of') or '')[:10] or None
    if session and fed_asof:
        lag=days_between(session,fed_asof)
        if lag is not None and lag>3:issue('FEDWATCH_STALE','WARN',f'FedWatch market_data_as_of={fed_asof}, observatory session={session}')
    if fed.get('freshness')=='LIVE' and fed.get('expected_market_data_date')!=fed_asof:issue('FEDWATCH_DECLARATION_INCONSISTENT','WARN',f"expected={fed.get('expected_market_data_date')} asof={fed_asof}")
    for k,q in us_sup_quality.items():
        if q.get('last_date')!=session or q.get('status')!='LIVE':issue('US_SUPPLEMENT_QUALITY_'+k,'WARN',str(q))
    if len({q.get('last_date') for q in kr_quality.values() if q.get('last_date')})>1:issue('KR_EQUITY_DATE_MISMATCH','CRITICAL',str({k:q.get('last_date') for k,q in kr_quality.items()}))
    for k,q in crypto_status.items():
        if q.get('status')!='LIVE':issue('CRYPTO_'+k+'_'+str(q.get('status')),'WARN',str(q))
    if (cal.get('actual_freshness') or {}).get('status') in {'DEGRADED','FAILED','ERROR','STALE'}:issue('CALENDAR_'+str((cal.get('actual_freshness') or {}).get('status')),'WARN','economic calendar actual-freshness warning')
    critical=[x for x in issues if x['severity']=='CRITICAL'];warnings=[x for x in issues if x['severity']=='WARN'];overall='FAIL' if critical else ('WARN' if warnings else 'PASS')
    return {'schema':'JJOONI_OBSERVATORY_DATA_AUDIT_V1','generated_kst':now.isoformat(timespec='seconds'),'overall':overall,'critical_count':len(critical),'warning_count':len(warnings),'observatory_session':session,'file_status':file_status,'groups':groups,'crypto_status':crypto_status,'issues':issues,'contracts':{'completed_session':'CORE_US_AND_US_SUPPLEMENT_MUST_MATCH_OBSERVATORY_SESSION','continuous_daily':'FX_ENERGY_METALS_MAY_LAG_CORE_BY_AT_MOST_1_CALENDAR_DAY','official_rates':'US_OFFICIAL_RATES_MAY_LAG_CORE_BY_AT_MOST_3_CALENDAR_DAYS_FOR_HOLIDAYS','no_account_data':True,'read_only':True},'read_only':True}

def main():
    out=build();OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('OBSERVATORY_DATA_AUDIT='+out['overall']);print('critical_count='+str(out['critical_count']));print('warning_count='+str(out['warning_count']));print('session='+str(out['observatory_session']))
    for x in out['issues']:print('ISSUE',x['severity'],x['code'],x['detail'])
if __name__=='__main__':main()
