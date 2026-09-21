import sys,unittest
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from official_bls_actuals import parse_bls
from calendar_actual_contract import retain_calendar
from enrich_economic_calendar import detail_specs

class HistoricalOfficialTests(unittest.TestCase):
 def parse(self,text,code,date='2026-09-16'):
  dt=datetime.fromisoformat(date).replace(tzinfo=ZoneInfo('America/New_York'))
  return {m['key']:m['actual'] for m in parse_bls(f'For release 8:30 a.m. {dt:%B} {dt.day}, {dt.year} '+text,code,dt)[0]}
 def test_import_export_direction(self):
  self.assertEqual(self.parse('U.S. import prices increased 0.7 percent in August. Prices for U.S. exports advanced 0.6 percent.','ximpim'),{'us_import_price_mom':'0.7%','us_export_price_mom':'0.6%'})
  self.assertEqual(self.parse('U.S. import prices decreased 0.3 percent. U.S. export prices were unchanged.','ximpim')['us_import_price_mom'],'-0.3%')
 def test_employment_yoy_is_not_monthly(self):
  v=self.parse('Total nonfarm payroll employment increased by 162,000 in August, and the unemployment rate was unchanged at 4.1 percent. Average hourly earnings for all employees on private nonfarm payrolls rose by 10 cents, or 0.3 percent, to $37.75. Over the year, average hourly earnings have increased by 3.1 percent.','empsit')
  self.assertEqual(v,dict(nfp='162K',unemployment='4.1%',avg_hourly_mom='0.3%',avg_hourly_yoy='3.1%'))
 def test_cpi_distinct_units(self):
  v=self.parse('Consumer Price Index for All Urban Consumers (CPI-U) increased 0.3 percent. Over the last 12 months, the all items index increased 2.7 percent. The index for all items less food and energy rose 0.2 percent. The all items less food and energy index rose 2.6 percent over the last 12 months.','cpi')
  self.assertEqual(v,dict(cpi_mom='0.3%',cpi_yoy='2.7%',core_cpi_mom='0.2%',core_cpi_yoy='2.6%'))
 def test_ppi_core_excludes_food_energy_not_trade(self):
  row='<table><tr>'+''.join('<td>'+x+'</td>' for x in ['Final demand less foods and energy(5)','FD','49104','89.078','3.0','0.8','-0.2','0.4','0.3','0.0'])+'</tr></table>'
  v=self.parse(row,'ppi');self.assertEqual(v['core_ppi_yoy'],'3.0%');self.assertEqual(v['core_ppi_mom'],'0.0%')
 def test_wrong_release_date_rejected(self):
  with self.assertRaises(ValueError):parse_bls('September 15, 2026 U.S. import prices rose 1.0 percent.','ximpim',datetime(2026,9,16))
 def test_substring_collision_fixed(self):
  self.assertEqual([m['key'] for m in detail_specs('Employment Situation of Veterans')],['veteran_unemployment'])
  self.assertEqual([m['key'] for m in detail_specs('State Job Openings and Labor Turnover')],['state_job_openings_decreased'])
 def test_bok_corrected_date_not_duplicate(self):
  old={'events':[dict(country='KR',title='한국은행 통화정책방향 결정회의',datetime_kst='2026-02-12T10:00+09:00',actual=None)]}
  new={'events':[dict(country='KR',title='한국은행 통화정책방향 결정회의',datetime_kst='2026-02-26T10:00+09:00',actual='2.50%')]}
  retain_calendar(new,old);self.assertEqual(len(new['events']),1);self.assertEqual(new['events'][0]['actual'],'2.50%')
