"""Date-bound BLS release-vintage collectors (never today's revised series)."""
import re,html
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

DEFS={
 'Consumer Price Index':('cpi',('cpi_yoy','cpi_mom','core_cpi_yoy','core_cpi_mom')),
 'Producer Price Index':('ppi',('ppi_mom','ppi_yoy','core_ppi_mom','core_ppi_yoy')),
 'Employment Situation':('empsit',('nfp','unemployment','avg_hourly_mom','avg_hourly_yoy')),
 'U.S. Import and Export Price Indexes':('ximpim',('us_import_price_mom','us_export_price_mom')),
 'Job Openings and Labor Turnover Survey':('jolts',('jolts',)),
 'Productivity and Costs':('prod2',('productivity','unit_labor')),
 'Employment Cost Index':('eci',('eci',)),
 'State Job Openings and Labor Turnover':('jltst',('state_job_openings_decreased',)),
 'Employment Situation of Veterans':('vet',('veteran_unemployment',)),
}
LABELS={'state_job_openings_decreased':'구인율 하락 주 수','veteran_unemployment':'참전군인 연평균 실업률'}

class TableRows(HTMLParser):
 def __init__(self,raw):
  super().__init__();self.rows=[];self.row=[];self.cell=None;self.feed(raw)
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.row=[]
  if tag in ('td','th'):self.cell=''
 def handle_data(self,data):
  if self.cell is not None:self.cell+=data
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.cell is not None:self.row.append(re.sub(r'\s+',' ',self.cell).strip());self.cell=None
  if tag=='tr' and self.row:self.rows.append(self.row);self.row=[]

def clean_text(raw):
 raw=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',raw,flags=re.I|re.S)
 return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',raw))).strip()

def signed(segment):
 m=re.search(r'(?P<verb>increased|rose|advanced|climbed|grew|edged up|moved up|decreased|declined|fell|falling|dropped|edged down|moved down|reduced)(?:\s+by)?\s+(-?\d+(?:\.\d+)?)\s*(?:percent|%)',segment,re.I)
 if m:return ('-' if m['verb'].lower() in ('decreased','declined','fell','falling','dropped','edged down','moved down','reduced') else '')+m[2]+'%'
 if re.search(r'(?:was|were|remained) unchanged',segment,re.I):return '0.0%'
 return None

def after(t,pat,n=220):
 m=re.search(pat,t,re.I)
 return t[m.end():m.end()+n] if m else ''

def parse_bls(raw,code,dt):
 t=clean_text(raw)
 m=re.search(r'(?:Transmission of material|For release\s+\d)',t,re.I)
 if m:t=t[m.start():]
 if not re.search(rf'{dt:%B}\s+{dt.day},?\s+{dt.year}',t[:1000],re.I):raise ValueError('BLS_RELEASE_DATE_MISMATCH')
 vals={}
 if code=='ximpim':
  vals['us_import_price_mom']=signed(after(t,r'U\.S\. import prices|Import prices',260))
  vals['us_export_price_mom']=signed(after(t,r'(?:prices for U\.S\. exports|U\.S\. export prices|Export prices)',220))
 elif code=='cpi':
  vals['cpi_mom']=signed(after(t,r'Consumer Price Index for All Urban Consumers\s*\(CPI-U\)',260))
  vals['cpi_yoy']=signed(after(t,r'Over the last 12 months,\s*the all items index',150))
  if not vals['cpi_yoy']:vals['cpi_yoy']=signed(after(t,r'The all items index',180))
  vals['core_cpi_mom']=signed(after(t,r'The index for all items less food and energy',140))
  vals['core_cpi_yoy']=signed(after(t,r'The all items less food and energy index',150))
 elif code=='ppi':
  vals['ppi_mom']=signed(after(t,r'Producer Price Index for final demand',220))
  vals['ppi_yoy']=signed(after(t,r'(?:On an unadjusted basis,\s*)the index for final demand',220))
  for row in TableRows(raw).rows:
   if len(row)>=9 and re.match(r'Final demand less foods and energy\b',row[0],re.I) and row[1]=='FD' and row[2]=='49104':
    nums=[re.sub(r'\([^)]*\)','',x).strip() for x in row[3:]]
    if re.fullmatch(r'-?\d+(?:\.\d+)?',nums[-1]):vals['core_ppi_mom']=nums[-1]+'%'
    if re.fullmatch(r'-?\d+(?:\.\d+)?',nums[1]):vals['core_ppi_yoy']=nums[1]+'%'
    break
 elif code=='empsit':
  lead=after(t,r'Total nonfarm payroll employment',250)
  n=re.search(r'(increased|rose|grew|declined|decreased|fell|changed little).*?([\d,]+)',lead,re.I)
  if n:vals['nfp']=('-' if n[1].lower() in ('declined','decreased','fell') else '')+f'{int(n[2].replace(",",""))/1000:g}K'
  u=re.search(r'unemployment rate.{0,80}?(\d+\.\d+) percent',t,re.I)
  if u:vals['unemployment']=u[1]+'%'
  a=after(t,r'average hourly earnings for all employees on private nonfarm payrolls',250)
  x=re.search(r'(?:or\s+)(\d+\.\d+) percent',a,re.I)
  if x:vals['avg_hourly_mom']=('-' if re.search('fell|declined|decreased',a[:80],re.I) else '')+x[1]+'%'
  elif re.search('unchanged',a[:120],re.I):vals['avg_hourly_mom']='0.0%'
  vals['avg_hourly_yoy']=signed(after(t,r'Over the (?:past 12 months|year),\s*average hourly earnings (?:have )?',150))
 elif code=='jolts':
  s=after(t,r'(?:The number of job openings|Job openings)',280)
  n=re.search(r'(\d+\.\d+) million',s)
  if n:vals['jolts']=n[1]+'M'
 elif code=='prod2':
  vals['productivity']=signed(after(t,r'Nonfarm business sector labor productivity',220))
  vals['unit_labor']=signed(after(t,r'Unit labor costs in the nonfarm business sector',180))
 elif code=='eci': vals['eci']=signed(after(t,r'Compensation costs for civilian workers',160))
 elif code=='jltst':
  s=after(t,r'Job openings rates',220)
  n=re.search(r'decreased in (\d+) states?',s,re.I)
  if n:vals['state_job_openings_decreased']=n[1]+' states'
  elif re.search(r'increased in \d+ states?.{0,40}(?:little changed|unchanged) in',s,re.I): vals['state_job_openings_decreased']='0 states'
 elif code=='vet':
  s=after(t,r'(?:jobless|unemployment) rate for all veterans',180)
  n=re.search(r'(?:to|at) (\d+\.\d+) percent',s)
  if n:vals['veteran_unemployment']=n[1]+'%'
 return [dict(key=k,label=LABELS.get(k,k),actual=v) for k,v in vals.items() if v is not None],t[:4000]

def collect_bls(e,kind,checks):
 from official_calendar_collectors import raw_fetch
 from calendar_actual_contract import release_time
 code=kind.removeprefix('BLS_');dt=release_time(e).astimezone(ZoneInfo('America/New_York'))
 url=f'https://www.bls.gov/news.release/archives/{code}_{dt:%m%d%Y}.htm'
 check={'adapter':kind,'title':e['title'],'url':url}
 try:
  raw=raw_fetch(url).decode('utf-8',errors='replace');rows,prefix=parse_bls(raw,code,dt)
  expected=DEFS[e['title']][1];missing=[k for k in expected if k not in {r['key'] for r in rows}]
  check.update(result='PARTIAL' if missing else 'PARSED',missing_metrics=missing)
  if missing:check['document_prefix']=prefix
  checks.append(check)
  return (rows,url) if rows else None
 except Exception as exc:
  check.update(result=f'HTTP_{exc.code}' if hasattr(exc,'code') else type(exc).__name__,error=str(exc)[:250]);checks.append(check);return None
