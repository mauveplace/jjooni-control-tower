"""Date-bound official adapters. Failed requests are observable, never empty success."""
import html
import io
import re
import urllib.request
import urllib.parse
from datetime import timedelta
from html.parser import HTMLParser
from calendar_actual_contract import KST, release_time, merge_observation, clean, actual_expected

UA = 'Mozilla/5.0 JJOONI-Official-Calendar/2.0'

class Links(HTMLParser):
    def __init__(self, raw):
        super().__init__(); self.rows=[]; self.href=None; self.label=''; self.feed(raw)
    def handle_starttag(self, tag, attrs):
        if tag=='a': self.href=dict(attrs).get('href'); self.label=''
    def handle_data(self, data):
        if self.href: self.label+=data
    def handle_endtag(self, tag):
        if tag=='a' and self.href: self.rows.append((self.href,self.label.strip())); self.href=None

def raw_fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=12) as r:
        raw=r.read()
    return raw

def text_fetch(url):
    raw=raw_fetch(url)
    if raw.startswith(b'%PDF'):
        from pypdf import PdfReader
        text=' '.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(raw)).pages)
    else:
        text=raw.decode('utf-8',errors='replace')
        text=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',text,flags=re.I|re.S)
        text=html.unescape(re.sub('<[^>]+>',' ',text))
    return re.sub(r'\s+',' ',text).strip()

def metric(key,label,actual,**kw):
    return dict(key=key,label=label,actual=actual,**kw)

def parse_claims(text,dt):
    # data.pdf rolls weekly: require the embargo/release date, not only a number.
    stamp=rf'{dt:%B}\s+{dt.day}\s*,?\s*{dt.year}'
    if not re.search(stamp,text[:1000],re.I): raise ValueError('RELEASE_DATE_MISMATCH')
    m=re.search(r'advance figure for seasonally adjusted initial claims was\s+([\d,]+)',text,re.I)
    if not m: raise ValueError('INITIAL_CLAIMS_PARSE_MISS')
    val=f'{int(m[1].replace(",",""))/1000:g}K'
    p=re.search(r"previous week.s (?:unrevised|revised) level of\s+([\d,]+)",text,re.I)
    return [metric('initial_claims','Initial Jobless Claims',val,**({'previous':f'{int(p[1].replace(",",""))/1000:g}K'} if p else {}))]

def parse_boj(text,dt):
    # PDF glyph spacing can split the year ("202 6"). Normalize only
    # whitespace; keep the complete release date bound to this event.
    header=re.sub(r'\s+','',text[:500])
    if not re.search(rf'{dt:%B}{dt.day},?{dt.year}(?!\d)',header,re.I): raise ValueError('RELEASE_DATE_MISMATCH')
    m=re.search(r'uncollateralized overnight call rate.{0,100}?around\s+([\d.]+)\s*percent',text,re.I)
    if not m: raise ValueError('BOJ_RATE_PARSE_MISS')
    return [metric('boj_policy_rate','BOJ overnight call rate target',f'{float(m[1]):.2f}%')]

def parse_boe(text,dt):
    if not re.search(rf'Published on\s+{dt.day}\s+{dt:%B}\s+{dt.year}',text,re.I): raise ValueError('RELEASE_DATE_MISMATCH')
    # Read decision paragraph, never the current-rate navigation badge.
    m=re.search(r'MPC\).*?voted.{0,100}?(maintain|increase|reduce).*?Bank Rate.*?(?:at|to)\s+([\d.]+)%',text,re.I)
    if not m: raise ValueError('BOE_RATE_PARSE_MISS')
    out=[metric('boe_bank_rate','Bank of England Bank Rate',f'{float(m[2]):.2f}%')]
    para=text[m.start():m.start()+650]
    majority=re.search(r'majority of\s+(\d+)\s*[–−-]\s*(\d+)',para)
    nums={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9}
    votes={'increase':0,'reduce':0,'maintain':0}
    if majority:
        votes[m[1].lower()]=int(majority[1])
        others=list(re.finditer(r'(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|\d+) members? (?:preferred|voted) to (increase|reduce|maintain)',para,re.I))
        for v in others: votes[v[2].lower()]=nums.get(v[1].lower(),int(v[1]) if v[1].isdigit() else 0)
        if sum(votes.values())==9:
            out.append(metric('boe_vote_split','MPC 금리투표 (인상-인하-동결)',f'{votes["increase"]}-{votes["reduce"]}-{votes["maintain"]}'))
    elif re.search(r'voted unanimously',para,re.I):
        votes[m[1].lower()]=9
        out.append(metric('boe_vote_split','MPC 금리투표 (인상-인하-동결)',f'{votes["increase"]}-{votes["reduce"]}-{votes["maintain"]}'))
    return out

def parse_bok(text,year,month):
    if not re.search(rf'{year}\s*년\s*{month}\s*월.*?생산자물가',text,re.S): raise ValueError('REFERENCE_PERIOD_MISMATCH')
    # Match total headline; sector-level inflation must not become the headline.
    part=re.split(rf'{year}\s*년\s*{month}\s*월\s*생산자물가지수',text,maxsplit=1)[-1][:1200]
    out=[]
    for key,label,pat in [('kr_ppi_mom','PPI MoM',r'전월\s*대비'),('kr_ppi_yoy','PPI YoY',r'전년\s*동월\s*대비')]:
        m=re.search(pat+r'\s*([\d.]+)\s*%\s*(상승|하락)',part)
        if m: out.append(metric(key,label,('-' if m[2]=='하락' else '')+m[1]+'%'))
        elif re.search(pat+r'\s*보합',part): out.append(metric(key,label,'0.0%'))
    idx=re.search(r'(?:생산자물가지수.{0,30}?\(2020\s*=\s*100\).{0,20}?|지수는\s*)(1\d{2}\.\d+)\b',part)
    if idx: out.append(metric('kr_ppi_index','PPI index (2020=100)',idx[1]))
    if not out: raise ValueError('BOK_HEADLINE_PARSE_MISS')
    return out

def adapter_id(e):
    t=e.get('title',''); c=e.get('country')
    if c=='US' and 'Initial Jobless Claims' in t: return 'DOL'
    if c=='KR' and '생산자물가' in t: return 'BOK'
    if c=='JP' and ('BOJ' in t or 'Bank of Japan' in t): return 'BOJ'
    if c=='GB' and 'Bank of England' in t: return 'BOE'
    return None

REGISTRY={'DOL':('initial_claims',),'BOK':('kr_ppi_mom','kr_ppi_yoy'),'BOJ':('boj_policy_rate',),'BOE':('boe_bank_rate','boe_vote_split')}

def discover_bok(e):
    period=re.search(r'(\d{4})년\s*(\d+)월',e['title'])
    if not period: raise ValueError('REFERENCE_PERIOD_MISSING')
    y,m=map(int,period.groups())
    url='https://www.bok.or.kr/portal/bbs/B0000501/list.do?menuNo=201264&searchCnd=1&searchKwd='+urllib.parse.quote(f'{y}년 {m}월 생산자물가지수')
    raw=raw_fetch(url).decode('utf-8',errors='replace')
    links=Links(raw).rows
    match=next((u for u,t in links if re.search(rf'{y}년\s*{m}월\s*생산자물가지수',t)),None)
    if not match: raise ValueError('BOK_RELEASE_LINK_NOT_FOUND')
    return urllib.parse.urljoin(url,html.unescape(match)),y,m

def collect(e,kind,checks):
    dt=release_time(e)
    if kind=='DOL':
        urls=[f'https://oui.doleta.gov/press/{dt.year}/{dt:%m%d%y}.pdf',f'https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/{dt.year}/ui-claims-{dt:%Y%m%d}.pdf','https://www.dol.gov/ui/data.pdf']
        parser=lambda t:parse_claims(t,dt)
    elif kind=='BOJ':
        urls=[f'https://www.boj.or.jp/en/mopo/mpmdeci/mpr_{dt.year}/k{dt:%y%m%d}a.pdf']
        parser=lambda t:parse_boj(t,dt)
    elif kind=='BOE':
        urls=[f'https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/{dt.year}/{dt:%B}'.lower()+f'-{dt.year}']
        parser=lambda t:parse_boe(t,dt)
    else:
        try:
            # A previously discovered official release URL remains valid after list rollover.
            url=e.get('official_release_url')
            if url:
                period=re.search(r'(\d{4})년\s*(\d+)월',e['title']); y,m=map(int,period.groups())
            else: url,y,m=discover_bok(e)
            raw=raw_fetch(url).decode('utf-8',errors='replace')
            urls=[urllib.parse.urljoin(url,html.unescape(u)) for u,t in Links(raw).rows if '.pdf' in t.lower()]
            urls.append(url)
            e['official_release_url']=url
            parser=lambda t:parse_bok(t,y,m)
        except Exception as exc:
            checks.append({'adapter':kind,'title':e['title'],'result':type(exc).__name__,'error':str(exc)[:200]}); return None
    for url in urls:
        check={'adapter':kind,'title':e['title'],'url':url}
        try:
            document=text_fetch(url)
            rows=parser(document); check['result']='PARSED'; checks.append(check)
            return rows,url
        except Exception as exc:
            if isinstance(exc,ValueError): check['document_prefix']=document[:300]
            check.update(result=f'HTTP_{exc.code}' if hasattr(exc,'code') else type(exc).__name__,error=str(exc)[:200]); checks.append(check)
    return None

def apply_official_actuals(calendar,now):
    checks=[]; updates=0; candidates=[]
    for e in calendar.get('events',[]):
        kind=adapter_id(e); dt=release_time(e)
        if not dt or not actual_expected(e): continue
        if kind:
            e['actual_watch']=True
            e['actual_expected']=True
        if e.get('time_status')=='TBD':
            e['sort_datetime_kst']=e['datetime_kst']; e['release_date']=dt.date().isoformat()
        old={m.get('key'):m for m in e.get('market_metrics',[])}
        for key in REGISTRY.get(kind,()):
            old.setdefault(key,metric(key,key,None))
        e['market_metrics']=list(old.values())
        start=dt.replace(hour=0,minute=0,second=0) if e.get('time_status')=='TBD' else dt
        if now<start: continue
        incomplete=clean(e.get('actual')) is None or any(actual_expected(m) and clean(m.get('actual')) is None for m in old.values())
        # Inspect recent window each refresh and keep older unresolved work observable.
        if now-dt>timedelta(days=14): continue
        if incomplete:
            candidates.append({'title':e['title'],'date':dt.date().isoformat(),'adapter':kind,
                               'official_adapter_status':'REGISTERED' if kind else 'NOT_REGISTERED',
                               'fallback_tiers':['SECONDARY','MARKET_FEED']})
        if not kind: continue
        if not incomplete and e.get('source_tier')=='OFFICIAL': continue
        result=collect(e,kind,checks)
        if not result: continue
        rows,url=result
        provenance={'source_tier':'OFFICIAL','source_url':url,'official_url':url,'checked_kst':now.isoformat(timespec='seconds'),'verification_status':'VERIFIED_OFFICIAL','source':kind+' official release'}
        for m in rows:
            m.update(provenance); old[m['key']]=merge_observation(old.get(m['key'],{}),m)
        representative=old[REGISTRY[kind][0]]
        patch=dict(provenance,actual=representative['actual'],market_metrics=list(old.values()),actual_source=kind+' official release')
        if clean(representative.get('previous')) is not None: patch['previous']=representative['previous']
        # Keep compact previous/consensus identical to primary metric.
        for f in ('previous','consensus'):
            if clean(representative.get(f)) is None and clean(e.get(f)) is not None: representative[f]=e[f]
        e.update(merge_observation(e,patch)); e['market_data_source']=kind+' official release'
        updates+=1
    calendar['actual_backfill']={'lookback_days':14,'unresolved_candidates':candidates,'checks':checks,'checked_kst':now.isoformat(timespec='seconds')}
    return updates,checks
