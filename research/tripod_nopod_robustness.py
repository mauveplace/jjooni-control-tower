#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, math, statistics, urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-output'; OUT.mkdir(exist_ok=True)
OUT_JSON=OUT/'tripod_nopod_robustness.json'; OUT_MD=OUT/'tripod_nopod_robustness.md'
UA='Mozilla/5.0 JJOONI-TRIPOD-ROBUSTNESS/1.0'; COST=.0005
BASE='https://raw.githubusercontent.com/tomlupo/ai-playground/main/data/samples/'


def txt(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/csv,*/*'})
    with urllib.request.urlopen(req,timeout=45) as r:return r.read().decode('utf-8-sig','ignore')

def fred(s):
    out={}
    for r in csv.DictReader(io.StringIO(txt('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+s))):
        d=r.get('observation_date') or r.get('DATE')
        try:v=float(r.get(s))
        except:continue
        if d and math.isfinite(v):out[d]=v
    return out

def etf(s):
    out={}
    for r in csv.DictReader(io.StringIO(txt(BASE+s+'.csv'))):
        d=r.get('Date'); raw=r.get('Close')
        try:v=float(raw)
        except:continue
        if d and math.isfinite(v):out[d]=v
    return out

def ff(ds,m):
    out=[];last=None
    for d in ds:
        if d in m:last=m[d]
        out.append(last)
    return out

def mean(x):return sum(x)/len(x)
def compound(rs):
    w=1.0
    for r in rs:w*=max(1e-12,1+r)
    return w-1

def metrics(ds,rs):
    p=[(d,r) for d,r in zip(ds,rs) if r is not None]
    rr=[r for _,r in p];w=1.;peak=1.;mdd=0.
    for r in rr:
        w*=max(1e-12,1+r);peak=max(peak,w);mdd=min(mdd,w/peak-1)
    yrs=len(rr)/252
    return {'cagr':w**(1/yrs)-1,'mdd':mdd,'terminal_multiple':w,'years':yrs,'start':p[0][0],'end':p[-1][0]}

def main():
    nd=fred('NASDAQ100');vx=fred('VIXCLS');y10m=fred('DGS10');y3m=fred('DGS3MO');ry10m=fred('DFII10');be10m=fred('T10YIE')
    px={s:etf(s) for s in ['IEF','SHY','GLD','DBC','QQQ']}
    ds=sorted(set(nd)&set(vx));idx={d:i for i,d in enumerate(ds)}
    n=[nd[d] for d in ds];v=[vx[d] for d in ds];y10=ff(ds,y10m);y3=ff(ds,y3m);ry=ff(ds,ry10m);be=ff(ds,be10m)
    st=[];dd=[];v10=[];prev=None
    for i,d in enumerate(ds):
        if i<251:st.append(None);dd.append(None);v10.append(None);continue
        ma=mean(n[i-249:i+1]);vv=mean(v[i-9:i+1]);hi=max(n[i-251:i+1]);d52=n[i]/hi-1
        if n[i]>ma*1.01:r='UP'
        elif n[i]<ma*.95:r='DOWN'
        else:r=prev
        if r is None:r='UP' if n[i]>=ma else 'DOWN'
        prev=r
        st.append(('TRIPOD' if vv<28 and d52>=-.09 else 'BIPOD') if r=='UP' else ('MONOPOD' if vv<18 else 'NOPOD'))
        dd.append(d52);v10.append(vv)
    es=[st[i-2] if i>=2 else None for i in range(len(ds))]
    # rate/macro features observable at signal date, then lagged two bars by referencing i-2
    common_all=sorted(set(ds)&set(px['IEF'])&set(px['SHY'])&set(px['GLD'])&set(px['DBC'])&set(px['QQQ']))
    common=[d for d in common_all if es[idx[d]]][1:]
    er={s:{} for s in px}
    for j in range(1,len(common_all)):
        a,b=common_all[j-1],common_all[j]
        for s in px:er[s][b]=px[s][b]/px[s][a]-1
    # momentum maps
    lookbacks=[42,63,84,126,189,252]
    mom={L:{s:{} for s in ['IEF','SHY','GLD','DBC']} for L in lookbacks}
    for s in ['IEF','SHY','GLD','DBC']:
        eds=sorted(px[s])
        for L in lookbacks:
            for j in range(L,len(eds)):
                mom[L][s][eds[j]]=px[s][eds[j]]/px[s][eds[j-L]]-1
    assets=['CASH','IEF','SHY','GLD','DBC','QQQ']
    def W(**kw):
        z={a:0. for a in assets};z.update(kw);return z
    def sig_date(d):
        i=idx[d];return ds[i-2] if i>=2 else None
    def top1(d,L,universe=('IEF','SHY','GLD','DBC')):
        sd=sig_date(d);vals=[(s,mom[L][s].get(sd)) for s in universe];vals=[x for x in vals if x[1] is not None]
        if not vals:return W(CASH=1)
        s,r=max(vals,key=lambda x:x[1]);return W(**{s:1}) if r>0 else W(CASH=1)
    def macro(d):
        i=idx[d]-2
        if i<100:return {'nom_down':False,'real_down':False,'be_up':False}
        nom_down=(y10[i] is not None and y10[i-20] is not None and y10[i]<y10[i-20] and all(x is not None for x in y10[i-99:i+1]) and y10[i]<mean(y10[i-99:i+1]))
        real_down=(ry[i] is not None and ry[i-20] is not None and ry[i]<ry[i-20])
        be_up=(be[i] is not None and be[i-20] is not None and be[i]>be[i-20])
        return {'nom_down':nom_down,'real_down':real_down,'be_up':be_up}
    names=['CASH']
    names += [f'GLD_{w}' for w in [10,25,33,50,67,75,100]]
    names += [f'MOM{L}_TOP1' for L in lookbacks]
    names += [f'GLD_POS{L}' for L in [63,126,252]]
    names += [f'IEF_GLD_MOM{L}' for L in [63,126,252]]
    names += ['MACRO_REAL_GLD50','MACRO_NOMIEF_REALGLD','MACRO_BE_GLD50']
    def weight(name,d):
        if name=='CASH':return W(CASH=1)
        if name.startswith('GLD_') and name.split('_')[1].isdigit():
            w=int(name.split('_')[1])/100;return W(CASH=1-w,GLD=w)
        if name.startswith('MOM') and '_TOP1' in name:
            L=int(name[3:name.index('_')]);return top1(d,L)
        if name.startswith('GLD_POS'):
            L=int(name[7:]);sd=sig_date(d);r=mom[L]['GLD'].get(sd)
            return W(GLD=1) if r is not None and r>0 else W(CASH=1)
        if name.startswith('IEF_GLD_MOM'):
            L=int(name[11:]);return top1(d,L,('IEF','GLD'))
        m=macro(d)
        if name=='MACRO_REAL_GLD50':return W(CASH=.5,GLD=.5) if m['real_down'] else W(CASH=1)
        if name=='MACRO_NOMIEF_REALGLD':
            if m['nom_down'] and m['real_down']:return W(CASH=.5,IEF=.5)
            if m['real_down']:return W(CASH=.5,GLD=.5)
            return W(CASH=1)
        if name=='MACRO_BE_GLD50':return W(CASH=.5,GLD=.5) if m['be_up'] else W(CASH=1)
        raise KeyError(name)
    rows=[]
    for d in common:
        i=idx[d];cash=(y3[i-1]/100/252) if i>0 and y3[i-1] is not None else 0.;ndr=n[i]/n[i-1]-1
        rows.append((d,i,cash,ndr))
    def eqret(state,r,rf):
        if state=='TRIPOD':return 3*r-2*rf-.0095/252
        if state in ('BIPOD','MONOPOD'):return 1.5*r-.5*rf-.00575/252
        return None
    results={};weights={}
    for name in names:
        rr=[];wh=[];prevw=W(CASH=1)
        for d,i,rf,nr in rows:
            state=es[i]
            if state=='NOPOD':
                w=weight(name,d);ret={'CASH':rf,**{s:er[s].get(d,0.) for s in px}}
                gross=sum(w[a]*ret[a] for a in assets);turn=.5*sum(abs(w[a]-prevw[a]) for a in assets);r=gross-COST*turn
            else:
                w=W(CASH=1);r=eqret(state,nr,rf)
                turn=.5*sum(abs(w[a]-prevw[a]) for a in assets);r-=COST*turn
            rr.append(r);wh.append(w);prevw=w
        results[name]=rr;weights[name]=wh
    full={n:metrics([x[0] for x in rows],results[n]) for n in names};base=full['CASH']
    comp={}
    for n,m in full.items():
        rat=m['terminal_multiple']/base['terminal_multiple'];comp[n]={'ann_increment_vs_cash':rat**(1/base['years'])-1,'terminal_ratio_vs_cash':rat,'cagr_diff_pp':100*(m['cagr']-base['cagr']),'mdd_diff_pp':100*(m['mdd']-base['mdd'])}
    # split sensitivity, no parameter fitting
    splits={}
    for lab,a,b in [('PRE2016',rows[0][0],'2015-12-31'),('POST2016','2016-01-01',None),('POST2020','2020-01-01',None)]:
        js=[j for j,(d,*_) in enumerate(rows) if d>=a and (b is None or d<=b)];sds=[rows[j][0] for j in js]
        splits[lab]={n:metrics(sds,[results[n][j] for j in js]) for n in names}
    # momentum selection distribution during NOPOD, helps detect whether momentum is merely GLD in disguise
    selection={}
    for L in lookbacks:
        n=f'MOM{L}_TOP1';c=Counter()
        for j,(d,i,*_) in enumerate(rows):
            if es[i]!='NOPOD':continue
            w=weights[n][j];a=max(w,key=w.get);c[a]+=1
        total=sum(c.values());selection[n]={a:{'days':c[a],'share':c[a]/total if total else 0} for a in assets if c[a]}
    out={'generated_utc':datetime.now(timezone.utc).isoformat(),'period':{'start':rows[0][0],'end':rows[-1][0],'days':len(rows)},'method':'Sensitivity study of NOPOD sleeve using actual adjusted-close broad ETF samples. Classical TRI-POD reconstruction; 2-return-bar execution lag; 5bp one-way sleeve turnover. Macro rules use current FRED history, not vintage releases.','full':full,'comparison':comp,'splits':splits,'momentum_selection':selection,'warning':'Exploratory only. Multiple variants imply selection bias; look for parameter plateaus and out-of-sample consistency, not the single best row.'}
    OUT_JSON.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    rank=sorted(names,key=lambda n:comp[n]['ann_increment_vs_cash'],reverse=True)
    L=['# TRI-POD NOPOD robustness study','',f"Period: {out['period']['start']} ~ {out['period']['end']}",'','| Variant | CAGR | MDD | Ann incr vs CASH | Terminal vs CASH | PRE2016 CAGR | POST2016 CAGR | POST2020 CAGR |','|---|---:|---:|---:|---:|---:|---:|---:|']
    for n in rank:
        m=full[n];c=comp[n]
        L.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {c['ann_increment_vs_cash']:.3%} | {c['terminal_ratio_vs_cash']:.3f}x | {splits['PRE2016'][n]['cagr']:.2%} | {splits['POST2016'][n]['cagr']:.2%} | {splits['POST2020'][n]['cagr']:.2%} |")
    L+=['','## Momentum selection share']
    for n,x in selection.items():L.append(f"- {n}: "+', '.join(f"{a} {z['share']:.1%}" for a,z in sorted(x.items(),key=lambda q:q[1]['days'],reverse=True)))
    OUT_MD.write_text('\n'.join(L)+'\n');print('\n'.join(L))
if __name__=='__main__':main()
