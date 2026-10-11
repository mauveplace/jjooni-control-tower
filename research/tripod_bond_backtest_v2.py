#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, math, statistics, urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT_DIR=ROOT/'research-output'; OUT_DIR.mkdir(exist_ok=True)
OUT_JSON=OUT_DIR/'tripod_bond_backtest_v2.json'; OUT_MD=OUT_DIR/'tripod_bond_backtest_v2.md'
COST=0.0005
UA='Mozilla/5.0 JJOONI-TRIPOD-BACKTEST/2.0'


def get_text(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/csv,*/*'})
    with urllib.request.urlopen(req,timeout=40) as r:return r.read().decode('utf-8-sig','ignore')


def fred(sid):
    txt=get_text('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+sid)
    out={}
    for r in csv.DictReader(io.StringIO(txt)):
        d=r.get('observation_date') or r.get('DATE') or r.get('date')
        raw=r.get(sid)
        try:v=float(raw)
        except:continue
        if d and math.isfinite(v):out[d]=v
    return out


def tlt_public():
    url='https://raw.githubusercontent.com/revred/TradeSmart.Tracker/refs/heads/main/market/us/tlt.csv'
    out={}
    for r in csv.DictReader(io.StringIO(get_text(url))):
        try:out[r['Date']]=float(r['Close'])
        except:pass
    return out,url


def mean(xs):return sum(xs)/len(xs) if xs else None

def compound(rs):
    w=1.0
    for r in rs:
        if r is not None:w*=max(1e-12,1+r)
    return w


def metrics(ds,rs):
    p=[(d,r) for d,r in zip(ds,rs) if r is not None]
    if not p:return {}
    rr=[r for _,r in p]; w=1.;peak=1.;mdd=0.;yrs=defaultdict(list);dn=[]
    for d,r in p:
        w*=max(1e-12,1+r);peak=max(peak,w);mdd=min(mdd,w/peak-1);yrs[d[:4]].append(r)
        if r<0:dn.append(r)
    ny=len(rr)/252; cagr=w**(1/ny)-1
    vol=statistics.stdev(rr)*math.sqrt(252) if len(rr)>1 else 0
    dvol=math.sqrt(sum(x*x for x in dn)/len(dn))*math.sqrt(252) if dn else 0
    yr={y:compound(x)-1 for y,x in yrs.items()}; wy=min(yr,key=yr.get)
    return {'start':p[0][0],'end':p[-1][0],'days':len(rr),'years':ny,'terminal_multiple':w,'cagr':cagr,'mdd':mdd,'ann_vol':vol,'sortino':((mean(rr)*252)/dvol if dvol else None),'calmar':(cagr/abs(mdd) if mdd else None),'worst_year':{'year':wy,'return':yr[wy]}}


def slice_metrics(ds,rs,a=None,b=None):
    x=[];y=[]
    for d,r in zip(ds,rs):
        if a and d<a:continue
        if b and d>b:continue
        x.append(d);y.append(r)
    return metrics(x,y)


def ff(dates,m):
    out=[];last=None
    for d in dates:
        if d in m:last=m[d]
        out.append(last)
    return out


def main():
    src={}
    for sid in ['NASDAQ100','VIXCLS','DGS10','DGS3MO']:
        src[sid]=fred(sid)
    dates=sorted(set(src['NASDAQ100'])&set(src['VIXCLS']))
    ndx=[src['NASDAQ100'][d] for d in dates]; vix=[src['VIXCLS'][d] for d in dates]
    y10=ff(dates,src['DGS10']); y3=ff(dates,src['DGS3MO'])

    # Signal calculation, exact classical TRI-POD thresholds.
    states=[];regs=[];prev=None
    for i,d in enumerate(dates):
        if i<251:
            states.append(None);regs.append(None);continue
        ma250=mean(ndx[i-249:i+1]);v10=mean(vix[i-9:i+1]);hi=max(ndx[i-251:i+1]);dd=ndx[i]/hi-1
        if ndx[i]>ma250*1.01:reg='UP'
        elif ndx[i]<ma250*0.95:reg='DOWN'
        else:reg=prev
        if reg is None:reg='UP' if ndx[i]>=ma250 else 'DOWN'
        prev=reg;regs.append(reg)
        if reg=='UP':st='TRIPOD' if (v10<28 and dd>=-0.09) else 'BIPOD'
        else:st='MONOPOD' if v10<18 else 'NOPOD'
        states.append(st)

    # Observable rate filters at signal close; no parameter optimization.
    trend=[False]*len(dates);dual=[False]*len(dates)
    for i in range(len(dates)):
        if i>=99 and y10[i] is not None and all(x is not None for x in y10[i-99:i+1]):
            ma100=mean(y10[i-99:i+1]);slope20=(i>=20 and y10[i-20] is not None and y10[i]<y10[i-20])
            trend[i]=bool(y10[i]<ma100 and slope20)
            dual[i]=bool(trend[i] and i>=20 and y3[i] is not None and y3[i-20] is not None and y3[i]<y3[i-20])

    # Close signal -> next close execution, so state t affects close(t+1)->close(t+2): 2-return-bar lag.
    es=[states[i-2] if i>=2 else None for i in range(len(dates))]
    et=[trend[i-2] if i>=2 else False for i in range(len(dates))]
    ed=[dual[i-2] if i>=2 else False for i in range(len(dates))]

    ndxr=[None]*len(dates);cash=[None]*len(dates);b10=[None]*len(dates)
    for i in range(1,len(dates)):
        ndxr[i]=ndx[i]/ndx[i-1]-1
        cash[i]=(y3[i-1]/100/252) if y3[i-1] is not None else 0.0
        if y10[i] is not None and y10[i-1] is not None:
            dy=(y10[i]-y10[i-1])/100
            # 7-10Y constant-duration Treasury total-return proxy.
            b10[i]=(y10[i-1]/100/252)-8.0*dy+0.5*75.0*dy*dy

    good=[i for i in range(len(dates)) if es[i] and ndxr[i] is not None and cash[i] is not None and b10[i] is not None]
    si=good[0]
    dates=dates[si:];es=es[si:];et=et[si:];ed=ed[si:];ndxr=ndxr[si:];cash=cash[si:];b10=b10[si:];y10=y10[si:];y3=y3[si:]

    def equity(st,i):
        r=ndxr[i] or 0;rf=cash[i] or 0
        if st=='TRIPOD':return 3*r-2*rf-0.0095/252
        if st in ('BIPOD','MONOPOD'):return 1.5*r-0.5*rf-0.00575/252
        return None

    defs={
      'CASH':lambda i:0.0,
      '10Y_25_ALWAYS':lambda i:0.25,
      '10Y_50_ALWAYS':lambda i:0.50,
      '10Y_100_ALWAYS':lambda i:1.00,
      '10Y_25_TREND':lambda i:0.25 if et[i] else 0.0,
      '10Y_50_TREND':lambda i:0.50 if et[i] else 0.0,
      '10Y_75_TREND':lambda i:0.75 if et[i] else 0.0,
      '10Y_100_TREND':lambda i:1.00 if et[i] else 0.0,
      '10Y_50_DUAL':lambda i:0.50 if ed[i] else 0.0,
      '10Y_100_DUAL':lambda i:1.00 if ed[i] else 0.0,
    }
    rets={};weights={}
    for n,fn in defs.items():
        rr=[];ww=[];prevw=0.0
        for i,st in enumerate(es):
            if st=='NOPOD':
                w=fn(i);r=(1-w)*(cash[i] or 0)+w*(b10[i] or 0)-COST*abs(w-prevw)
            else:
                w=0.;r=equity(st,i)
                if prevw>0:r-=COST*prevw
            rr.append(r);ww.append(w);prevw=w
        rets[n]=rr;weights[n]=ww

    full={n:metrics(dates,r) for n,r in rets.items()};base=full['CASH'];comp={}
    for n,m in full.items():
        rat=m['terminal_multiple']/base['terminal_multiple']
        comp[n]={'terminal_ratio_vs_cash':rat,'ann_increment_vs_cash':rat**(1/base['years'])-1,'cagr_diff_pp':100*(m['cagr']-base['cagr']),'mdd_diff_pp':100*(m['mdd']-base['mdd'])}

    splits={}
    for lab,a,b in [('1991_2002',dates[0],'2002-12-31'),('2003_2010','2003-01-01','2010-12-31'),('2011_2019','2011-01-01','2019-12-31'),('2020_PLUS','2020-01-01',None)]:
        splits[lab]={n:slice_metrics(dates,r,a,b) for n,r in rets.items()}

    # NOPOD episodes and sleeve-only return comparisons.
    eps=[];cur=None
    for i,st in enumerate(es):
        if st=='NOPOD' and cur is None:cur=[i,i]
        elif st=='NOPOD':cur[1]=i
        elif cur is not None:eps.append(cur);cur=None
    if cur:eps.append(cur)
    eprows=[]
    for a,b in eps:
        z={'start':dates[a],'end':dates[b],'days':b-a+1,'rate_start':y10[a],'rate_end':y10[b]}
        for n in ['CASH','10Y_50_ALWAYS','10Y_50_TREND','10Y_100_TREND','10Y_50_DUAL']:
            z[n]=compound(rets[n][a:b+1])-1
        eprows.append(z)

    # Actual TLT robustness from public adjusted price history (available 2011+).
    actual={'available':False}
    try:
        tlt,url=tlt_public(); idx={d:i for i,d in enumerate(dates)};td=[d for d in dates if d in tlt];tr={}
        for j in range(1,len(td)):tr[td[j]]=tlt[td[j]]/tlt[td[j-1]]-1
        acts={}
        for n,wmax,mode in [('TLT_50_ALWAYS',.5,'always'),('TLT_100_ALWAYS',1,'always'),('TLT_50_TREND',.5,'trend'),('TLT_100_TREND',1,'trend')]:
            dd=[];rr=[];pw=0
            for d in td[1:]:
                i=idx[d];st=es[i]
                if st=='NOPOD':
                    on=(mode=='always' or et[i]);w=wmax if on else 0;r=(1-w)*(cash[i] or 0)+w*tr[d]-COST*abs(w-pw)
                else:
                    w=0;r=equity(st,i)
                    if pw>0:r-=COST*pw
                dd.append(d);rr.append(r);pw=w
            acts[n]=metrics(dd,rr)
        dd=[];rr=[]
        for d in td[1:]:
            i=idx[d];dd.append(d);rr.append((cash[i] or 0) if es[i]=='NOPOD' else equity(es[i],i))
        acts['CASH']=metrics(dd,rr);ab=acts['CASH']
        for n,m in acts.items():
            if n=='CASH':continue
            rat=m['terminal_multiple']/ab['terminal_multiple'];m['ann_increment_vs_cash']=rat**(1/ab['years'])-1;m['mdd_diff_pp']=100*(m['mdd']-ab['mdd'])
        actual={'available':True,'source':url,'start':td[1],'end':td[-1],'variants':acts}
    except Exception as e:actual={'available':False,'error':repr(e)}

    diag={'sources':{sid:{'count':len(m),'oldest':min(m) if m else None,'latest':max(m) if m else None} for sid,m in src.items()},'test_start':dates[0],'test_end':dates[-1],'days':len(dates),'nopod_days':sum(x=='NOPOD' for x in es),'nopod_share':sum(x=='NOPOD' for x in es)/len(es),'nopod_episodes':len(eps),'trend_on_nopod':sum(1 for i,x in enumerate(es) if x=='NOPOD' and et[i]),'dual_on_nopod':sum(1 for i,x in enumerate(es) if x=='NOPOD' and ed[i])}
    out={'generated_utc':datetime.utcnow().isoformat(timespec='seconds')+'Z','methodology':{'market':'FRED NASDAQ100','vix':'FRED VIXCLS','rates':'FRED DGS10 + DGS3MO','signal':'classical TRI-POD 250/1.01/0.95 + VIX10 28/18 + 52w drawdown 9%; next-close execution','cash':'prior DGS3MO / 252','bond_proxy':'10Y constant-duration proxy: prior yield carry/252 - 8*delta_y + 0.5*75*delta_y^2','rate_trend':'DGS10 < MA100 AND DGS10 < DGS10 20 trading days ago','dual':'rate_trend AND DGS3MO falling over 20 trading days','bond_turnover_cost':COST,'warning':'Absolute Max returns are reconstruction proxies; overlay-vs-cash deltas are primary. Synthetic 10Y proxy is not an ETF.'},'diagnostics':diag,'full':full,'comparison':comp,'splits':splits,'actual_tlt':actual,'episodes':eprows}
    OUT_JSON.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    L=['# TRI-POD NOPOD Bond Overlay — FRED full-history backtest','',f"Period: {dates[0]} ~ {dates[-1]} | NOPOD {diag['nopod_days']} days / {diag['nopod_episodes']} episodes ({diag['nopod_share']:.1%})",'', '| Variant | CAGR | MDD | Terminal vs CASH | Ann incr vs CASH |','|---|---:|---:|---:|---:|']
    for n in defs:
        m=full[n];c=comp[n];L.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {c['terminal_ratio_vs_cash']:.3f}x | {c['ann_increment_vs_cash']:.3%} |")
    L+=['','## NOPOD episodes','','| Start | End | Days | 10Y start→end | Cash | 10Y50 always | 10Y50 trend | 10Y100 trend | 10Y50 dual |','|---|---|---:|---|---:|---:|---:|---:|---:|']
    for z in eprows:L.append(f"| {z['start']} | {z['end']} | {z['days']} | {z['rate_start']:.2f}%→{z['rate_end']:.2f}% | {z['CASH']:.2%} | {z['10Y_50_ALWAYS']:.2%} | {z['10Y_50_TREND']:.2%} | {z['10Y_100_TREND']:.2%} | {z['10Y_50_DUAL']:.2%} |")
    if actual.get('available'):
        L+=['',f"## Actual TLT robustness {actual['start']} ~ {actual['end']}",'','| Variant | CAGR | MDD | Ann incr vs CASH |','|---|---:|---:|---:|']
        for n,m in actual['variants'].items():L.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {m.get('ann_increment_vs_cash','') if n!='CASH' else '' if True else ''} |")
    OUT_MD.write_text('\n'.join(L)+'\n',encoding='utf-8');print(OUT_MD.read_text(encoding='utf-8'))

if __name__=='__main__':main()
