#!/usr/bin/env python3
import csv,io,json,math,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'research-output';OUT.mkdir(exist_ok=True)
UA='Mozilla/5.0 JJOONI-TRIPOD-BACKTEST/3.0';COST=.0005

def text(url):
 r=urllib.request.Request(url,headers={'User-Agent':UA});
 with urllib.request.urlopen(r,timeout=40) as x:return x.read().decode('utf-8-sig','ignore')
def fred(s):
 out={}
 for r in csv.DictReader(io.StringIO(text('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+s))):
  d=r.get('observation_date') or r.get('DATE');
  try:v=float(r.get(s))
  except:continue
  if d and math.isfinite(v):out[d]=v
 return out
def yahoo(sym):
 q=urllib.parse.urlencode({'interval':'1d','range':'max','includePrePost':'false','events':'div,splits'})
 obj=json.loads(text('https://query1.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(sym)+'?'+q));b=obj['chart']['result'][0];ts=b['timestamp'];
 adj=(((b.get('indicators') or {}).get('adjclose') or [{}])[0]).get('adjclose')
 if not adj:adj=(((b.get('indicators') or {}).get('quote') or [{}])[0]).get('close')
 out={}
 for t,v in zip(ts,adj):
  if v is None:continue
  d=datetime.fromtimestamp(t,timezone.utc).date().isoformat();out[d]=float(v)
 return out

def ff(ds,m):
 z=[];last=None
 for d in ds:
  if d in m:last=m[d]
  z.append(last)
 return z
def mean(x):return sum(x)/len(x)
def comp(rs):
 w=1
 for r in rs:w*=1+r
 return w-1

def main():
 nd=fred('NASDAQ100');vx=fred('VIXCLS');y10m=fred('DGS10');y3m=fred('DGS3MO');ief=yahoo('IEF');tlt=yahoo('TLT')
 ds=sorted(set(nd)&set(vx));n=[nd[d] for d in ds];v=[vx[d] for d in ds];y10=ff(ds,y10m);y3=ff(ds,y3m)
 st=[];prev=None
 for i,d in enumerate(ds):
  if i<251:st.append(None);continue
  ma=mean(n[i-249:i+1]);v10=mean(v[i-9:i+1]);hi=max(n[i-251:i+1]);dd=n[i]/hi-1
  if n[i]>ma*1.01:r='UP'
  elif n[i]<ma*.95:r='DOWN'
  else:r=prev
  if r is None:r='UP' if n[i]>=ma else 'DOWN'
  prev=r
  st.append(('TRIPOD' if v10<28 and dd>=-.09 else 'BIPOD') if r=='UP' else ('MONOPOD' if v10<18 else 'NOPOD'))
 f20=[];ftrend=[]
 for i in range(len(ds)):
  slope=bool(i>=20 and y10[i]!=None and y10[i-20]!=None and y10[i]<y10[i-20]);f20.append(slope)
  ftrend.append(bool(slope and i>=99 and all(x is not None for x in y10[i-99:i+1]) and y10[i]<mean(y10[i-99:i+1])))
 es=[st[i-2] if i>=2 else None for i in range(len(ds))];e20=[f20[i-2] if i>=2 else False for i in range(len(ds))];etr=[ftrend[i-2] if i>=2 else False for i in range(len(ds))]
 idx={d:i for i,d in enumerate(ds)}
 result={'generated_utc':datetime.now(timezone.utc).isoformat(),'method':'Actual adjusted-close IEF/TLT; compare only NOPOD sleeve to DGS3MO cash. 5bp one-way bond turnover. Same TRI-POD signals and next-close execution.','sources':{'NDX':'FRED NASDAQ100','VIX':'FRED VIXCLS','10Y':'FRED DGS10','cash':'FRED DGS3MO','IEF':'Yahoo chart adjusted close','TLT':'Yahoo chart adjusted close'},'etfs':{}}
 for sym,px in [('IEF',ief),('TLT',tlt)]:
  common=[d for d in ds if d in px and es[idx[d]]]
  prs={}
  for j in range(1,len(common)):prs[common[j]]=px[common[j]]/px[common[j-1]]-1
  common=[d for d in common[1:] if d in prs]
  cash_daily={d:(y3[idx[d]-1]/100/252 if idx[d]>0 and y3[idx[d]-1] is not None else 0) for d in common}
  variants={}
  for name,wmax,mode in [('50_ALWAYS',.5,'always'),('100_ALWAYS',1,'always'),('50_SLOPE20',.5,'slope'),('100_SLOPE20',1,'slope'),('50_TREND',.5,'trend'),('100_TREND',1,'trend')]:
   ratio=1.;overlay=[];cashs=[];pw=0.;bond_days=0;nop=0
   for d in common:
    i=idx[d];state=es[i]
    if state=='NOPOD':
     nop+=1;on=(mode=='always' or (mode=='slope' and e20[i]) or (mode=='trend' and etr[i]));w=wmax if on else 0
     ro=(1-w)*cash_daily[d]+w*prs[d]-COST*abs(w-pw);rc=cash_daily[d]
     overlay.append(ro);cashs.append(rc);ratio*=((1+ro)/(1+rc));bond_days+=int(w>0)
    else:
     if pw>0: ratio*=max(1e-12,1-COST*pw)
     w=0
    pw=w
   if pw>0:ratio*=max(1e-12,1-COST*pw)
   years=(datetime.fromisoformat(common[-1])-datetime.fromisoformat(common[0])).days/365.25
   variants[name]={'terminal_ratio_vs_cash':ratio,'annualized_increment_vs_cash':ratio**(1/years)-1,'nopod_overlay_return':comp(overlay),'nopod_cash_return':comp(cashs),'nopod_days':nop,'bond_days':bond_days}
  result['etfs'][sym]={'start':common[0],'end':common[-1],'price_points':len(px),'variants':variants}
 (OUT/'tripod_bond_actual_etf_check.json').write_text(json.dumps(result,indent=2)+'\n')
 L=['# Actual IEF/TLT check','']
 for sym,x in result['etfs'].items():
  L += [f"## {sym} {x['start']} ~ {x['end']}",'','| Variant | Terminal vs cash | Ann increment | NOPOD bond | NOPOD cash | Bond days |','|---|---:|---:|---:|---:|---:|']
  for n,z in x['variants'].items():L.append(f"| {n} | {z['terminal_ratio_vs_cash']:.3f}x | {z['annualized_increment_vs_cash']:.3%} | {z['nopod_overlay_return']:.2%} | {z['nopod_cash_return']:.2%} | {z['bond_days']} |")
 (OUT/'tripod_bond_actual_etf_check.md').write_text('\n'.join(L)+'\n');print('\n'.join(L))
if __name__=='__main__':main()
