import copy
import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
import yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import refresh_observatory_kr_rates as kr
import publish_observatory_data as pub
import audit_observatory_data as audit

class SourceIsolationTest(unittest.TestCase):
    def test_transient_timeout_recovers_on_second_attempt(self):
        response=io.BytesIO(b'{"ok":true}')
        with patch.object(kr.urllib.request,'urlopen',side_effect=[TimeoutError(),response]) as fetch, patch.object(kr.time,'sleep'):
            self.assertEqual(kr._get_json('https://ecos.bok.or.kr/api/private-key'),{'ok':True})
        self.assertEqual(fetch.call_count,2)
        self.assertEqual(fetch.call_args.kwargs['timeout'],10)

    def test_timeout_budget_is_bounded_and_error_redacts_key(self):
        with patch.object(kr.urllib.request,'urlopen',side_effect=urllib.error.URLError('secret-key')) as fetch, patch.object(kr.time,'sleep'), patch.object(kr,'_fallback_json',side_effect=RuntimeError('ECOS_CURL_FALLBACK_TIMEOUT')):
            with self.assertRaisesRegex(RuntimeError,'ECOS_TRANSPORT_FAILED_AFTER_3_ATTEMPTS') as caught:
                kr._get_json('https://ecos.bok.or.kr/api/secret-key')
        self.assertEqual(fetch.call_count,3)
        self.assertNotIn('secret-key',str(caught.exception))

    def test_concurrent_daily_publish_preserves_newer_kr_repair_and_failure(self):
        remote={'generated_kst':'2026-10-13T14:00:00+09:00','series':{'KR3Y':[{'date':'2026-10-09','value':3.9}]},'latest':{'KR3Y':3.9}}
        local={'generated_kst':'2026-10-13T12:00:00+09:00','kr_rates_refreshed_kst':'2026-10-13T13:00:00+09:00','series':{'KR3Y':[{'date':'2026-10-12','value':4.011}]},'cross_market_freshness_quality':{'KR_RATES':{'fetch_succeeded':False,'status':'LAGGING'}}}
        for left,right in ((local,remote),(remote,local)):
            got=pub.merge_generated('market-observatory/data/observatory.json',left,right)
            self.assertEqual(got['generated_kst'],remote['generated_kst'])
            self.assertEqual(got['latest']['KR3Y'],4.011)
            self.assertEqual(len(got['series']['KR3Y']),2)
            self.assertFalse(got['cross_market_freshness_quality']['KR_RATES']['fetch_succeeded'])

    def test_concurrent_daily_publish_preserves_supplemental_same_session_only(self):
        remote={'generated_kst':'2026-10-13T14:00:00+09:00','us_completed_session_date':'2026-10-12','series':{'WTI':[{'date':'2026-10-09','value':90}]}}
        local={'generated_kst':'2026-10-13T12:00:00+09:00','us_completed_session_date':'2026-10-12','supplemental_refreshed_kst':'2026-10-13T13:00:00+09:00','series':{'WTI':[{'date':'2026-10-12','value':93.16}]}}
        got=pub.merge_generated('market-observatory/data/observatory.json',local,remote)
        self.assertEqual(got['latest']['WTI'],93.16)
        remote['us_completed_session_date']='2026-10-13'
        got=pub.merge_generated('market-observatory/data/observatory.json',local,remote)
        self.assertEqual(got['series']['WTI'],remote['series']['WTI'])

    def test_audit_does_not_declare_cached_dates_live_after_failed_fetch(self):
        obs=audit.load(audit.DATA/'observatory.json')
        obs=copy.deepcopy(obs)
        obs['cross_market_freshness_quality']={'KR_RATES':{'fetch_succeeded':False,'failed_series':{'KR3Y':'timeout'}}}
        real_load=audit.load
        with patch.object(audit,'load',side_effect=lambda path,*args:obs if Path(path).name=='observatory.json' else real_load(path,*args)):
            got=audit.build()
        self.assertEqual(got['groups']['kr_rates']['state'],'STALE')
        self.assertTrue(any(i['code']=='GROUP_KR_RATES_STALE' for i in got['issues']))

    def test_today_sentiment_is_valid_after_previous_us_cash_session(self):
        from datetime import datetime,timedelta
        today=datetime.now(audit.KST).date()
        obs=copy.deepcopy(audit.load(audit.DATA/'observatory.json'))
        obs['us_completed_session_date']=(today-timedelta(days=1)).isoformat()
        obs.setdefault('series',{})['FEAR_GREED']=[{'date':today.isoformat(),'value':45.4}]
        obs.setdefault('latest',{})['FEAR_GREED']=45.4
        real_load=audit.load
        with patch.object(audit,'load',side_effect=lambda path,*args:obs if Path(path).name=='observatory.json' else real_load(path,*args)):
            self.assertEqual(audit.build()['groups']['sentiment']['state'],'LIVE')
            obs['series']['FEAR_GREED'][0]['date']=(today+timedelta(days=1)).isoformat()
            self.assertEqual(audit.build()['groups']['sentiment']['state'],'AHEAD_OF_ANCHOR')

    def test_concurrent_fedwatch_index_preserves_both_revisions(self):
        def document(digest,generated):
            return {'entries':[{'market_data_as_of':'2026-10-09','revisions':[{'sha256':digest,'path':digest+'.json','generated_kst':generated}]}]}
        got=pub.merge_generated('market-observatory/data/fedwatch-history/index.json',document('a','2026-10-13T12:00:00'),document('b','2026-10-13T13:00:00'))
        entry=got['entries'][0]
        self.assertEqual(len(entry['revisions']),2)
        self.assertEqual(entry['path'],'b.json')

    def test_skipped_heartbeat_never_enters_canonical_writer_queue(self):
        daily=yaml.safe_load((ROOT/'.github/workflows/market-observatory-daily.yml').read_text())
        verified=yaml.safe_load((ROOT/'.github/workflows/market-observatory-calendar-verified.yml').read_text())
        self.assertNotIn('concurrency',daily)
        self.assertNotIn('concurrency',verified)
        for name in ('us_close_gate','hourly_gate'):
            self.assertNotIn('concurrency',daily['jobs'][name])
        for job in (daily['jobs']['build'],daily['jobs']['hourly_refresh'],verified['jobs']['verify-calendar']):
            self.assertEqual(job['concurrency']['group'],'economic-calendar-canonical-writer')
            self.assertIn('if',job)

    def test_daily_publishes_all_fedwatch_generated_outputs(self):
        src=(ROOT/'.github/workflows/market-observatory-daily.yml').read_text()
        publication=next(line for line in src.splitlines() if 'publish_observatory_data.py' in line and 'fed-watch.json' in line)
        self.assertIn('find market-observatory/data/fedwatch-history -type f',publication)

    def test_failed_collector_cannot_skip_independent_publish_and_remains_visible(self):
        workflow=yaml.safe_load((ROOT/'.github/workflows/market-observatory-supplemental-freshness.yml').read_text())
        self.assertEqual(workflow['concurrency']['group'],'observatory-cross-market-writer')
        steps=workflow['jobs']['refresh']['steps']
        collectors={s['id']:s for s in steps if s.get('id')}
        for name in ('supplemental','kr_rates','fedwatch','sector'):
            self.assertTrue(collectors[name]['continue-on-error'])
        names=[s.get('name') for s in steps]
        self.assertLess(names.index('Publish repaired market sources'),names.index('Final cross-market health acceptance'))
        final=steps[-1]
        self.assertIn("accept_observatory_sources.py",final['run'])
        publication=next(s for s in steps if s.get("name")=="Publish repaired market sources")["run"]
        self.assertIn("data-audit.json",publication)
        self.assertIn("freshness-status.json",publication)
        self.assertIn('critical_count',next(s for s in steps if s.get('name')=='Audit all Observatory data')['run'])

if __name__=='__main__':unittest.main()
