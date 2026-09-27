#!/usr/bin/env python3
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=spec_from_file_location('calendar_market_events',ROOT/'tools'/'calendar_market_events.py')
MOD=module_from_spec(SPEC);SPEC.loader.exec_module(MOD)

calendar={'events':[{
    'datetime_kst':'2026-09-17T03:00+09:00','title':'FOMC 정책결정','country':'US',
    'market_data_source':'FairEconomy/ForexFactory','market_metrics':[
        {'key':'fed_rate','label':'Federal Funds Rate','previous':'3.75%','consensus':'4.00%','actual':None}
    ]
}]}
fedwatch={
    'meeting_date':'2026-09-16','market_data_as_of':'2026-09-14',
    'hike_25bp_probability':0.928125,
    'history':[
        {'trade_date':'2026-09-11','hike_25bp_probability':0.867857},
        {'trade_date':'2026-09-14','hike_25bp_probability':0.928125},
    ],
}
assert MOD.apply_fedwatch_metric(calendar,fedwatch) is True
event=calendar['events'][0]
metric=next(m for m in event['market_metrics'] if m['key']=='fedwatch_hike_25bp')
assert metric['previous']=='86.8%',metric
assert metric['consensus']=='92.8%',metric
assert metric['actual'] is None,metric
assert metric['value_role']=='market_forecast',metric
assert event.get('actual') is None,event
assert MOD.merge_sources('A + B','B + C','A')=='A + B + C'
print('CALENDAR_MARKET_SEMANTICS_TEST=PASS')


# Recurring US macro schedule regression: claims + S&P Global PMI.
from datetime import date
BSPEC=spec_from_file_location('build_market_observatory',ROOT/'tools'/'build_market_observatory.py')
BUILD=module_from_spec(BSPEC);BSPEC.loader.exec_module(BUILD)
rows=[]
BUILD.us_claims_events(rows,today=date(2026,9,27),horizon_days=90)
BUILD.spglobal_pmi_events(rows,today=date(2026,9,27),months_ahead=2)
by={(e['datetime_kst'],e['title']):e for e in rows}
assert ('2026-10-01T21:30+09:00','U.S. Initial Jobless Claims') in by,sorted(by)[:8]
assert ('2026-11-25T22:30+09:00','U.S. Initial Jobless Claims') in by,'Thanksgiving holiday adjustment missing'
assert ('2026-10-01T22:45+09:00','S&P Global US Manufacturing PMI') in by
assert ('2026-10-05T22:45+09:00','S&P Global US Services & Composite PMI') in by
assert by[('2026-10-05T22:45+09:00','S&P Global US Services & Composite PMI')]['schedule_rule']=='THIRD_WORKING_DAY_0945_ET'

ESPEC=spec_from_file_location('enrich_economic_calendar',ROOT/'tools'/'enrich_economic_calendar.py')
ENRICH=module_from_spec(ESPEC);ESPEC.loader.exec_module(ENRICH)
pmi_keys={x['key'] for x in ENRICH.detail_specs('S&P Global US Services & Composite PMI')}
assert pmi_keys=={'sp_us_services_pmi','sp_us_composite_pmi'},pmi_keys
nfp_keys={x['key'] for x in ENRICH.detail_specs('Employment Situation')}
assert {'nfp','unemployment','avg_hourly_mom','avg_hourly_yoy'}<=nfp_keys,nfp_keys
print('CALENDAR_RECURRING_CORE_EVENTS_TEST=PASS')
