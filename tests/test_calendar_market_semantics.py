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
