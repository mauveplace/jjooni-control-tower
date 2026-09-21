import copy
import sys
import unittest
from pathlib import Path
from datetime import datetime, timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from calendar_actual_contract import *
from official_calendar_collectors import parse_claims, parse_boj, parse_boe, parse_bok, apply_official_actuals
from unittest.mock import patch

class CalendarActualRegression(unittest.TestCase):
    def setUp(self): self.now=datetime(2026,9,21,13,tzinfo=KST)
    def event(self,**kw):
        return dict({'title':'Release','country':'US','importance':2,'datetime_kst':(self.now-timedelta(hours=1)).isoformat(),'actual':None,'market_metrics':[]},**kw)
    def status(self,e): return build_freshness({'events':[e]},self.now,[])['status']
    def test_01_importance_two(self): self.assertEqual(self.status(self.event()),'DEGRADED')
    def test_02_empty_metrics(self): self.assertEqual(self.status(self.event(importance=3)),'DEGRADED')
    def test_03_no_eight_hour_expiry(self):
        for days in (1,14,120): self.assertEqual(self.status(self.event(datetime_kst=(self.now-timedelta(days=days)).isoformat())),'DEGRADED')
    def test_04_future(self): self.assertEqual(self.status(self.event(datetime_kst=(self.now+timedelta(days=1)).isoformat())),'LIVE')
    def test_05_probability_and_forecast(self):
        for kw in ({'metric_type':'market_probability_snapshot'},{'value_role':'market_forecast'},{'actual_expected':False},{'value_role':'schedule_only'}):
            self.assertEqual(self.status(self.event(**kw)),'LIVE')
        e=self.event(actual='4%',market_metrics=[{'actual':None,'metric_type':'market_probability_snapshot'}])
        self.assertEqual(self.status(e),'LIVE')
    def test_06_null_never_erases(self):
        self.assertEqual(merge_observation({'actual':'196K'},{'actual':None})['actual'],'196K')
    def test_07_official_priority_both_orders(self):
        official={'actual':'196K','source_tier':'OFFICIAL','source_url':'https://www.dol.gov/ui/data.pdf'}
        secondary={'actual':'197K','source_tier':'SECONDARY'}
        for a,b in [(official,secondary),(secondary,official)]: self.assertEqual(merge_observation(a,b)['actual'],'196K')
        self.assertEqual(merge_observation(official,{'actual':None,'source_tier':'MARKET_FEED','source_url':'other'})['source_url'],official['source_url'])
    def test_08_boj_placeholder(self):
        e=self.event(time_status='TBD',datetime_kst='2026-09-21T12:00+09:00')
        self.assertEqual(self.status(e),'PENDING')
        self.assertEqual(e['actual_due_kst'],'2026-09-22T00:00:00+09:00')
        self.now+=timedelta(days=1); self.assertEqual(self.status(e),'DEGRADED')
    def test_09_rollover_preserves_events_and_actuals(self):
        old={'events':[self.event(actual='196K')]}; cur={'events':[]}
        retain_calendar(cur,old); self.assertEqual(cur['events'][0]['actual'],'196K')
        nextweek={'events':[self.event(actual=None)]}; retain_calendar(nextweek,cur)
        self.assertEqual(nextweek['events'][0]['actual'],'196K')
    def test_pending_grace(self): self.assertEqual(self.status(self.event(datetime_kst=(self.now-timedelta(minutes=10)).isoformat())),'PENDING')
    def test_watchlist(self): self.assertEqual(self.status(self.event(importance=1,actual_watch=True)),'DEGRADED')
    def test_partial_metrics(self): self.assertEqual(self.status(self.event(actual='3.75%',market_metrics=[{'key':'vote','actual':None}])),'DEGRADED')
    def test_claims_date_bound(self):
        dt=datetime(2026,9,17,tzinfo=KST)
        text='Thursday, September 17, 2026 advance figure for seasonally adjusted initial claims was 196,000 previous week’s unrevised level of 206,000'
        self.assertEqual(parse_claims(text,dt)[0]['actual'],'196K')
        with self.assertRaises(ValueError): parse_claims(text,dt-timedelta(days=7))
    def test_boj_parser(self):
        rows=parse_boj('September 18, 2026 The Bank will encourage the uncollateralized overnight call rate to remain at around 1.25 percent.',datetime(2026,9,18,tzinfo=KST))
        self.assertEqual(rows[0]['actual'],'1.25%')
    def test_boe_parser(self):
        rows=parse_boe('Published on 17 September 2026 At its meeting ending on 16 September 2026, the Monetary Policy Committee (MPC) voted by a majority of 6–3 to maintain Bank Rate at 3.75%. Three members voted to increase Bank Rate by 0.25 percentage points, to 4%.',datetime(2026,9,17,tzinfo=KST))
        self.assertEqual([r['actual'] for r in rows],['3.75%','3-0-6'])
    def test_bok_parser(self):
        rows=parse_bok('2026년 8월 생산자물가지수는 전월대비 0.2% 상승 (전년동월대비 7.9% 상승)',2026,8)
        self.assertEqual([r['actual'] for r in rows],['0.2%','7.9%'])
    def test_source_failure_visible_and_isolated(self):
        c={'events':[self.event(title='U.S. Initial Jobless Claims')]}
        with patch('official_calendar_collectors.raw_fetch',side_effect=TimeoutError('timeout')):
            n,checks=apply_official_actuals(c,self.now)
        self.assertEqual(n,0); self.assertTrue(checks); self.assertEqual(self.status(c['events'][0]),'DEGRADED')
    def test_archive_roundtrip_official(self):
        from calendar_market_events import apply_overrides
        import tempfile,json
        old=self.event(actual='196K',source_tier='OFFICIAL',source_url='official',market_metrics=[{'key':'claims','label':'Claims','actual':'196K','source_tier':'OFFICIAL','source_url':'official'}])
        c={'events':[self.event()]}
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'archive.json';p.write_text(json.dumps({'overrides':[dict(old,match={'date':old['datetime_kst'][:10],'country':'US','title_contains':'Release'})]}))
            with patch('calendar_market_events.OVR',p): apply_overrides(c)
        self.assertEqual(c['events'][0]['actual'],'196K'); self.assertEqual(c['events'][0]['source_tier'],'OFFICIAL')

if __name__=='__main__': unittest.main()
