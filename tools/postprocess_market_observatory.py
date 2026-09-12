#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OBS=ROOT/'market-observatory'/'data'/'observatory.json'
CAL=ROOT/'market-observatory'/'data'/'economic-calendar.json'
KST=ZoneInfo('Asia/Seoul'); ET=ZoneInfo('America/New_York')
UA='Mozilla/5.0 JJOONI-Market-Observatory-Post/1.1'
KR={'KR3Y':'010200000','KR5Y':'010200001','KR10Y':'010210000','KR20Y':'010220000','KR30Y':'010230000'}


def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)

def get_text(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'})
    with urllib.request.urlopen(req,timeout=25) as r:return r.read().decode('utf-8','ignore')

def ecos_page(item,start,end,pos,last,key):
    url=f'https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/{pos}/{last}/817Y002/D/{start}/{end}/{item}'
    return get_json(url).get('StatisticSearch') or {}

def ecos_series(item,start,end,key='sample',cap=400):
    size=10 if key=='sample' else 1000; pos=1;rows=[];total=None
    while pos<=cap:
        block=ecos_page(item,start,end,pos,pos+size-1,key)
        batch=block.get('row') or []
        if total is None:
            try:total=int(block.get('list_total_count') or 0)
            except:total=0
        rows.extend(batch)
        if not batch or pos+size>total:break
        pos+=size
    out=[]
    for r in rows:
        try:v=float(r.get('DATA_VALUE'))
        except:continue
        t=str(r.get('TIME') or '')
        if len(t)==8:t=f'{t[:4]}-{t[4:6]}-{t[6:8]}'
        if len(t)==10:out.append({'date':t,'value':v})
    ded={x['date']:x for x in out};return [ded[k] for k in sorted(ded)]

def merge(a,b):
    d={x['date']:x for x in (a or [])};d.update({x['date']:x for x in (b or [])});return [d[k] for k in sorted(d)]

def patch_rates(o):
    key=os.getenv('BOK_ECOS_API_KEY') or 'sample'; now=datetime.now(KST)
    s=o.setdefault('series',{}); latest=o.setdefault('latest',{})
    first=not bool(s.get('KR3Y'))
    start=(now-timedelta(days=370 if first else 45)).strftime('%Y%m%d');end=now.strftime('%Y%m%d')
    errors={}
    for name,item in KR.items():
        try:
            fresh=ecos_series(item,start,end,key,cap=320 if first else 80)
            if fresh:s[name]=merge(s.get(name),fresh)
            latest[name]=s[name][-1]['value'] if s.get(name) else None
        except Exception as exc:errors[name]=type(exc).__name__
    if s.get('KR3Y') and s.get('KR10Y'):
        a={x['date']:x['value'] for x in s['KR10Y']};b={x['date']:x['value'] for x in s['KR3Y']};s['KR_3S10S']=[{'date':d,'value':round(a[d]-b[d],8)} for d in sorted(set(a)&set(b))];latest['KR_3S10S']=s['KR_3S10S'][-1]['value'] if s['KR_3S10S'] else None
    us=latest.get('US10Y_OFFICIAL') or latest.get('US10Y')
    if latest.get('KR10Y') is not None and us is not None:latest['KR_US_10Y']=round(latest['KR10Y']-us,8)
    o.setdefault('quality',{})['kr_rates']={'state':'PASS' if latest.get('KR10Y') is not None else 'UNAVAILABLE','source':'BOK_ECOS','window':'1Y_BACKFILL_THEN_45D_INCREMENT','errors':errors}


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.row=[]
        elif tag in ('td','th') and self.row is not None: self.cell=[]
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None and self.row is not None:
            self.row.append(re.sub(r'\s+',' ',' '.join(self.cell)).strip()); self.cell=None
        elif tag=='tr' and self.row is not None:
            if any(self.row):self.rows.append(self.row)
            self.row=None;self.cell=None

DATE_RE=re.compile(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2})\s+(20\d{2})',re.I)

def _te_rows(slug,code):
    txt=get_text(f'https://tradingeconomics.com/{slug}/calendar')
    p=_TableParser();p.feed(txt);out=[];current=None
    for cells in p.rows:
        joined=' '.join(cells);m=DATE_RE.search(joined)
        if m:
            try:current=datetime.strptime(f'{m.group(2)} {m.group(3)} {m.group(4)}','%B %d %Y').date().isoformat()
            except:current=None
            if len(cells)<=2:continue
        if not current:continue
        idx=next((i for i,x in enumerate(cells) if x.strip().upper()==code),None)
        if idx is None:continue
        tail=[x.strip() for x in cells[idx+1:]]
        if not tail:continue
        event=tail[0]
        # Calendar table contract: Event | Actual | Previous | Consensus | Forecast.
        vals=(tail[1:]+['','','',''])[:4]
        out.append({'date':current,'event':event,'actual':vals[0],'previous':vals[1],'consensus':vals[2],'forecast':vals[3]})
    return out

def _norm(s):return re.sub(r'[^a-z0-9가-힣]+',' ',str(s).lower()).strip()

def _date_near(a,b):
    try:return abs((datetime.fromisoformat(a).date()-datetime.fromisoformat(b).date()).days)<=1
    except:return False

METRIC_RULES=[
    (('consumer price index','소비자물가동향'),['Inflation Rate YoY','Core Inflation Rate YoY']),
    (('producer price index','생산자물가지수'),['PPI YoY','Core PPI YoY']),
    (('employment situation',),['Non Farm Payrolls','Unemployment Rate']),
    (('job openings','jolts'),['Job Openings']),
    (('personal income and outlays',),['Core PCE Price Index YoY','PCE Price Index YoY','Personal Spending MoM']),
    (('gdp','실질 gdp'),['GDP Growth Rate QoQ','GDP Growth Rate YoY']),
    (('산업활동동향',),['Industrial Production YoY','Industrial Production MoM']),
    (('고용동향',),['Unemployment Rate','Employment Change']),
    (('fomc','통화정책방향 결정회의'),['Interest Rate Decision','Fed Interest Rate Decision']),
]

def _preferred_metrics(title):
    n=_norm(title)
    for needles,metrics in METRIC_RULES:
        if any(_norm(x) in n for x in needles):return metrics
    return []

def _find_metric(rows,date,name):
    nn=_norm(name);best=None
    for r in rows:
        if not _date_near(date,r['date']):continue
        ev=_norm(r['event'])
        score=0
        if nn==ev:score=100
        elif nn in ev or ev in nn:score=80
        else:
            a=set(nn.split());b=set(ev.split());score=len(a&b)*10
        if score and (best is None or score>best[0]):best=(score,r)
    return best[1] if best else None

def enrich_market_expectations(c):
    rows={};errors={}
    for country,slug,code in [('US','united-states','US'),('KR','south-korea','KR')]:
        try:rows[country]=_te_rows(slug,code)
        except Exception as exc:rows[country]=[];errors[country]=type(exc).__name__
    enriched=0
    for e in c.get('events') or []:
        country=e.get('country');date=str(e.get('datetime_kst') or '')[:10]
        metrics=[]
        for wanted in _preferred_metrics(e.get('title','')):
            r=_find_metric(rows.get(country,[]),date,wanted)
            if not r:continue
            metrics.append({'label':r['event'],'actual':r['actual'] or None,'previous':r['previous'] or None,'consensus':r['consensus'] or None,'forecast':r['forecast'] or None,'source':'Trading Economics'})
        if metrics:
            e['market_metrics']=metrics[:3]
            first=metrics[0];e['actual']=first.get('actual');e['consensus']=first.get('consensus');e['previous']=first.get('previous')
            e['expectations_source']='Trading Economics';enriched+=1
    c.setdefault('quality',{})['market_expectations']={'state':'PASS' if enriched else ('DEGRADED' if errors else 'NO_MATCH'),'source':'Trading Economics public calendar','enriched_events':enriched,'errors':errors,'contract':'official schedule + market consensus overlay'}
    if 'Trading Economics' not in c.setdefault('sources',[]):c['sources'].append('Trading Economics')

def patch_calendar(c):
    events=c.get('events') or []
    # Correct FOMC statement timestamps: 2 p.m. ET on second meeting day -> KST with DST.
    fomc=['2026-01-28','2026-03-18','2026-04-29','2026-06-17','2026-07-29','2026-09-16','2026-10-28','2026-12-09']
    bydate={d:datetime.strptime(d+' 14:00','%Y-%m-%d %H:%M').replace(tzinfo=ET).astimezone(KST).isoformat(timespec='minutes') for d in fomc}
    for e in events:
        if e.get('source')=='Federal Reserve' and 'FOMC' in e.get('title',''):
            raw=str(e.get('datetime_kst') or '')[:10]
            if raw in bydate:e['datetime_kst']=bydate[raw]
    y=datetime.now(KST).year; lo=f'{y}-01-01';hi=f'{y+1}-12-31'
    events=[e for e in events if lo<=str(e.get('datetime_kst') or '')[:10]<=hi]
    events.sort(key=lambda e:e.get('datetime_kst') or '')
    c['events']=events;c['generated_kst']=datetime.now(KST).isoformat(timespec='seconds');c['time_contract']='ALL_TIMES_KST';c['importance_contract']='3=market_moving,2=major,1=reference'
    enrich_market_expectations(c)

def main():
    o=json.loads(OBS.read_text(encoding='utf-8'));c=json.loads(CAL.read_text(encoding='utf-8'))
    patch_rates(o);patch_calendar(c)
    o['generated_kst']=datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');CAL.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    q=(c.get('quality') or {}).get('market_expectations') or {}
    print('MARKET_OBSERVATORY_POSTPROCESS=PASS')
    print('KR10Y=',o.get('latest',{}).get('KR10Y'),'KR3S10S=',o.get('latest',{}).get('KR_3S10S'),'calendar=',len(c.get('events') or []),'expectations=',q.get('enriched_events',0))
if __name__=='__main__':main()
