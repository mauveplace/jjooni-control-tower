import json
import sys
import unittest
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import official_calendar_collectors as collectors
from calendar_actual_contract import KST,build_freshness
from calendar_market_events import apply_overrides


class EmploymentCalendarTests(unittest.TestCase):
    def setUp(self):
        self.text=(ROOT/'tests/fixtures/kr-employment-202609.txt').read_text()

    def test_official_release_separates_seasonal_raw_and_youth_unemployment(self):
        rows=collectors.parse_kr_employment(self.text,2026,9)
        values={m['key']:m['actual'] for m in rows}
        self.assertEqual(values,{'kr_unemployment_sa':'2.6%','kr_unemployment':'2%','kr_employment_rate':'70.6%','kr_employed':'29266'})
        with self.assertRaises(ValueError):collectors.parse_kr_employment(self.text,2026,8)
        with self.assertRaises(ValueError):collectors.parse_kr_employment(self.text.replace('계절조정 실업률','알 수 없는 지표'),2026,9)

    def test_registered_collector_discovers_exact_reference_month(self):
        event={'country':'KR','title':'2026년 9월 고용동향','datetime_kst':'2026-10-16T08:00+09:00','importance':2}
        page='https://mods.go.kr/board.es?bid=210&list_no=447479&act=view'
        html='<a href="'+page+'">2026년 9월 고용동향</a><a href="/old">2026년 8월 고용동향</a>'
        with patch.object(collectors,'raw_fetch',return_value=html.encode()),patch.object(collectors,'text_fetch',return_value=self.text):
            data={'events':[event]}
            count,checks=collectors.apply_official_actuals(data,datetime(2026,10,21,22,tzinfo=KST))
        self.assertEqual(count,1);self.assertEqual(event['actual'],'2.6%')
        self.assertEqual(event['source_tier'],'OFFICIAL')
        self.assertEqual(event['official_release_url'],page)
        self.assertEqual(build_freshness(data,datetime(2026,10,21,22,tzinfo=KST),checks)['overdue_count'],0)

    def test_verified_recovery_survives_network_failure_without_inventing_actual(self):
        event={'country':'KR','title':'2026년 9월 고용동향','datetime_kst':'2026-10-16T08:00+09:00','importance':2,'actual':None}
        data={'events':[event]};apply_overrides(data)
        data['events']=[event]
        self.assertEqual(event['actual'],'2.6%')
        with patch.object(collectors,'collect',side_effect=AssertionError('verified release cannot require refetch')):
            collectors.apply_official_actuals(data,datetime(2026,10,21,22,tzinfo=KST))
        self.assertEqual(build_freshness(data,datetime(2026,10,21,22,tzinfo=KST),[])['overdue_count'],0)

    def test_existing_historical_headline_is_not_relabelled_or_made_incomplete(self):
        event={'country':'KR','title':'2026년 7월 고용동향','datetime_kst':'2026-08-12T08:00+09:00','importance':2,'actual':'123K','source_tier':'OFFICIAL','market_metrics':[]}
        data={'events':[event]}
        with patch.object(collectors,'collect',side_effect=AssertionError('no reinterpretation')):
            collectors.apply_official_actuals(data,datetime(2026,10,21,22,tzinfo=KST))
        self.assertEqual(event['actual'],'123K');self.assertEqual(event['market_metrics'],[])
        self.assertEqual(build_freshness(data,datetime(2026,10,21,22,tzinfo=KST),[])['overdue_count'],0)

    def test_observatory_has_no_literal_newline_text_outside_scripts(self):
        class TextNodes(HTMLParser):
            def __init__(self):super().__init__();self.skip=False;self.text=[]
            def handle_starttag(self,tag,attrs):
                if tag in ('script','style'):self.skip=True
            def handle_endtag(self,tag):
                if tag in ('script','style'):self.skip=False
            def handle_data(self,text):
                if not self.skip:self.text.append(text)
        parser=TextNodes();parser.feed((ROOT/'market-observatory/index.html').read_text())
        self.assertNotIn('\\n',''.join(parser.text))


if __name__=='__main__':unittest.main()
