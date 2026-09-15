#!/usr/bin/env python3
from datetime import datetime
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
SPEC=spec_from_file_location('build_market_observatory',ROOT/'tools'/'build_market_observatory.py')
MOD=module_from_spec(SPEC);SPEC.loader.exec_module(MOD)
ET=ZoneInfo('America/New_York')

def rows(*dates):
    return [{'date':d,'value':float(i+1)} for i,d in enumerate(dates)]

preclose=datetime(2026,9,15,7,30,tzinfo=ET)
postclose=datetime(2026,9,15,16,30,tzinfo=ET)
sample=rows('2026-09-11','2026-09-14','2026-09-15')
assert [x['date'] for x in MOD.completed_us_bars(sample,preclose)]==['2026-09-11','2026-09-14']
assert [x['date'] for x in MOD.completed_us_bars(sample,postclose)][-1]=='2026-09-15'

series={
    'NASDAQ100':rows('2026-09-11','2026-09-14'),
    'SP500':rows('2026-09-11','2026-09-14'),
    'VIX':rows('2026-09-11','2026-09-14','2026-09-15'),
}
assert MOD.align_completed_us_market_series(series)=='2026-09-14'
assert {k:v[-1]['date'] for k,v in series.items()}=={
    'NASDAQ100':'2026-09-14','SP500':'2026-09-14','VIX':'2026-09-14'
}
print('MARKET_OBSERVATORY_COMPLETED_SESSION_TEST=PASS')
