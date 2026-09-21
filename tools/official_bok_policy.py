"""BOK meeting dates and dated decision attachments share one official table."""
import re,urllib.parse
from functools import lru_cache
from datetime import datetime
from calendar_actual_contract import KST,release_time
URL='https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?menuNo=200755&mtgSe=A'

@lru_cache(maxsize=4)
def meetings(year):
 from official_calendar_collectors import raw_fetch,Links
 raw=raw_fetch(URL+'&searchYear='+str(year)).decode('utf-8',errors='replace')
 rows=[]
 for tr in re.findall(r'<tr\b[^>]*>.*?</tr>',raw,re.I|re.S):
  clean=re.sub('<[^>]+>',' ',tr)
  m=re.search(r'(\d{1,2})\s*월\s*(\d{1,2})\s*일',clean)
  if not m:continue
  pdf=next((u for u,t in Links(tr).rows if '국문보도자료' in t and '.pdf' in t.lower()),None)
  rows.append({'date':f'{year}-{int(m[1]):02d}-{int(m[2]):02d}','url':urllib.parse.urljoin(URL,pdf) if pdf else None})
 if not rows:raise ValueError('BOK_MEETING_TABLE_PARSE_MISS')
 return rows

def correct_date(e,now):
 dt=release_time(e)
 row=next((r for r in meetings(dt.year) if r['date'][:7]==dt.strftime('%Y-%m')),None)
 if not row:raise ValueError('BOK_MEETING_MONTH_NOT_LISTED')
 date=row['date']
 if date!=dt.date().isoformat():
  e.setdefault('schedule_corrected_from',e['datetime_kst']);e['datetime_kst']=date+'T10:00+09:00'
  e['release_date']=date;e.pop('actual_due_kst',None)
 e['schedule_source_url']=URL;e['schedule_checked_kst']=now.isoformat(timespec='seconds')
 return row

def collect_policy(e,checks):
 from official_calendar_collectors import text_fetch
 dt=release_time(e);check={'adapter':'BOK_RATE','title':e['title']}
 try:
  row=next(r for r in meetings(dt.year) if r['date']==dt.date().isoformat())
  if not row['url']:raise ValueError('BOK_DECISION_NOT_PUBLISHED')
  check['url']=row['url'];t=text_fetch(row['url'])
  # Require the statement date, then the committee's rate decision paragraph.
  compact=re.sub(r'\s+','',t)
  if not re.search(rf'{dt.year}[년.]0?{dt.month}[월.]0?{dt.day}(?:일|\.)',compact):raise ValueError('BOK_DECISION_DATE_MISMATCH')
  part=t[:2000]
  m=re.search(r'한국은행\s*기준금리.{0,180}?(\d+\.\d+)\s*%\s*(?:로|에서|수준)',part)
  if not m:raise ValueError('BOK_RATE_PARSE_MISS')
  # A change is written "2.50%에서 2.75%로"; prefer the destination.
  dest=re.search(r'기준금리.{0,220}?\d+\.\d+\s*%\s*에서\s*(\d+\.\d+)\s*%\s*로',part)
  value=dest[1] if dest else m[1]
  check['result']='PARSED';checks.append(check)
  return [dict(key='bok_base_rate',label='한국은행 기준금리',actual=f'{float(value):.2f}%')],row['url']
 except Exception as exc:
  check.update(result=type(exc).__name__,error=str(exc)[:250])
  if 't' in locals():check['document_prefix']=t[:1800]
  checks.append(check);return None
