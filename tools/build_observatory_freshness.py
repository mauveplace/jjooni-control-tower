#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
KST = ZoneInfo('Asia/Seoul')
OUT = ROOT / 'market-observatory' / 'data' / 'freshness-status.json'


def load(path: Path) -> dict:
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception:return {}


def text(value):
    value=str(value or '').strip();return value or None


def group(label,state,generated_kst=None,as_of=None,detail=None,source=None,critical=False):
    return {'label':label,'state':text(state) or 'UNAVAILABLE','generated_kst':text(generated_kst),'as_of':text(as_of),'detail':text(detail),'source':text(source),'critical':bool(critical)}


def _aggregate_states(states):
    xs=[text(x) or 'UNAVAILABLE' for x in states]
    if any(x in {'UNAVAILABLE','FAILED','ERROR'} for x in xs):return 'UNAVAILABLE'
    if any(x in {'STALE'} for x in xs):return 'STALE'
    if any(x in {'FALLBACK','STALE_FALLBACK','DEGRADED'} for x in xs):return 'DEGRADED'
    if any(x in {'LAGGING'} for x in xs):return 'LAGGING'
    return 'LIVE'


def build_status(root: Path = ROOT) -> dict:
    data=root/'market-observatory'/'data'
    obs=load(data/'observatory.json');pulse=load(data/'daily-market-pulse.json');fed=load(data/'fed-watch.json');cal=load(data/'economic-calendar.json');sector=load(data/'sector-etf.json');public=load(root/'public-market-daily.json')

    obs_fresh=obs.get('freshness') or {};fgq=(obs.get('quality') or {}).get('fear_greed') or {};tripod=obs.get('tripod_latest') or {};public_tripod=public.get('tripod_signal') or {};supp=obs.get('market_supplement_quality') or {}
    session=text(obs.get('us_completed_session_date'));pulse_session=text(pulse.get('market_date_us'));tripod_session=text(public_tripod.get('date') or tripod.get('date'))
    pulse_aligned=bool(session and pulse_session==session and pulse.get('snapshot_status')=='FINAL');tripod_aligned=bool(session and tripod_session==session and public_tripod.get('ok') is True);source_session=text(public_tripod.get('date'));market_aligned=bool(session and (not source_session or session>=source_session))

    kr_kospi=supp.get('KOSPI') or {};kr_kosdaq=supp.get('KOSDAQ') or {};kr_state=_aggregate_states([kr_kospi.get('status'),kr_kosdaq.get('status')]);kr_asof=max([x for x in [text(kr_kospi.get('last_date')),text(kr_kosdaq.get('last_date'))] if x],default=None)
    us_keys=('RUSSELL2000','DOW','NASDAQCOMPOSITE');us_items=[supp.get(k) or {} for k in us_keys];us_supplement_aligned=bool(session and all(text(x.get('last_date'))==session for x in us_items));us_state=_aggregate_states([x.get('status') for x in us_items])
    if session and not us_supplement_aligned and us_state!='UNAVAILABLE':us_state='LAGGING'
    aligned=bool(market_aligned and pulse_aligned and tripod_aligned and us_supplement_aligned)

    market_state=text(obs_fresh.get('status')) or ('LIVE' if obs.get('generated_kst') else 'UNAVAILABLE')
    if not market_aligned:market_state='MISALIGNED' if session and source_session else 'UNAVAILABLE'
    pulse_state='LIVE' if pulse_aligned else ('MISALIGNED' if session and pulse_session else 'UNAVAILABLE')
    fg_state=text(fgq.get('state')) or ('LIVE' if (obs.get('latest') or {}).get('FEAR_GREED') is not None else 'UNAVAILABLE')
    fed_state=text(fed.get('freshness')) or ('LIVE' if fed.get('market_data_as_of') else 'UNAVAILABLE')
    tripod_state='LIVE' if tripod_aligned else ('MISALIGNED' if session and tripod_session else 'UNAVAILABLE')
    cal_fresh=cal.get('actual_freshness') or {};cal_state=text(cal_fresh.get('status')) or ('LIVE' if cal.get('generated_kst') else 'UNAVAILABLE');sector_state='LIVE' if sector.get('as_of_date') else 'UNAVAILABLE'

    groups={
        'market':group('Market SSOT',market_state,obs.get('generated_kst'),session,'미국 핵심 완료세션 기준 · KR/미국보조는 별도 날짜검증','observatory.json',True),
        'kr_equity':group('KR Equity',kr_state,obs.get('equity_enriched_kst'),kr_asof,f"KOSPI {kr_kospi.get('last_date') or '—'} · KOSDAQ {kr_kosdaq.get('last_date') or '—'}",f"{kr_kospi.get('source') or '—'} / {kr_kosdaq.get('source') or '—'}",True),
        'us_supplement':group('US Supplement',us_state,obs.get('equity_enriched_kst'),session,f"RUT {us_items[0].get('last_date') or '—'} · DOW {us_items[1].get('last_date') or '—'} · IXIC {us_items[2].get('last_date') or '—'}",'Yahoo completed cash-session daily',False),
        'pulse':group('Daily Pulse',pulse_state,pulse.get('generated_kst'),pulse_session,f"snapshot={pulse.get('snapshot_status') or '—'} · Observatory session={session or '—'}",'daily-market-pulse.json',True),
        'fear_greed':group('Fear & Greed',fg_state,obs.get('generated_kst'),fgq.get('observed_at') or session,f"{(obs.get('latest') or {}).get('FEAR_GREED','—')}/100 · {(obs.get('latest') or {}).get('FEAR_GREED_RATING') or ''}".strip(),fgq.get('source') or 'CNN_FEAR_GREED_PUBLIC',False),
        'fedwatch':group('FedWatch',fed_state,fed.get('generated_kst'),fed.get('market_data_as_of'),f"FOMC {fed.get('meeting_date') or '—'}",'fed-watch.json',False),
        'tripod':group('TRI-POD',tripod_state,public.get('generated_kst') or obs.get('generated_kst'),tripod_session,f"{tripod.get('regime') or public_tripod.get('regime') or '—'} · {tripod.get('target') or public_tripod.get('target') or '—'}",'public-market-daily.json + observatory.json',True),
        'calendar':group('Economic Calendar',cal_state,cal.get('generated_kst'),cal_fresh.get('latest_released_at') or cal.get('generated_kst'),f"events={len(cal.get('events') or [])}",'economic-calendar.json',False),
        'sector':group('Sector ETF',sector_state,sector.get('generated_kst'),sector.get('as_of_date'),f"priced={(sector.get('summary') or {}).get('priced_count','—')}",'sector-etf.json',False),
    }
    hard_bad={'UNAVAILABLE','FAILED','ERROR','MISALIGNED'};soft_bad={'LAGGING','STALE','STALE_FALLBACK','DEGRADED','PENDING','FALLBACK'}
    critical_bad=[k for k,v in groups.items() if v['critical'] and v['state'] in hard_bad];warnings=[k for k,v in groups.items() if v['state'] in soft_bad or (not v['critical'] and v['state'] in hard_bad)]
    overall='DEGRADED' if critical_bad else ('LIVE_WITH_WARNINGS' if warnings else 'LIVE')
    return {'schema':'JJOONI_OBSERVATORY_FRESHNESS_STATUS_V1','generated_kst':datetime.now(KST).isoformat(timespec='seconds'),'overall':overall,'critical_bad':critical_bad,'warnings':warnings,'watchdog_required':bool(critical_bad),'session_alignment':{'source_session':source_session,'market_aligned':market_aligned,'observatory':session,'daily_market_pulse':pulse_session,'tripod':tripod_session,'pulse_aligned':pulse_aligned,'tripod_aligned':tripod_aligned,'us_supplement_aligned':us_supplement_aligned,'kr_kospi':kr_kospi.get('last_date'),'kr_kosdaq':kr_kosdaq.get('last_date'),'aligned':aligned},'groups':groups,'contract':'DISPLAY_SOURCE_ASOF_STATE_AND_WATCHDOG_DECISION_V2','read_only':True}


def main():
    status=build_status(ROOT);OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('OBSERVATORY_FRESHNESS_STATUS=PASS',status['overall'],'aligned=',status['session_alignment']['aligned'])

if __name__=='__main__':main()
